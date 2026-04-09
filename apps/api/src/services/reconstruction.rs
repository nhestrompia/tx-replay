use sha2::{Digest, Sha256};

use crate::models::api::{Fill, Position, PositionDirection, ReplayEvent, ReplayEventType};

#[derive(Debug, Clone)]
pub struct PositionFilter {
    pub pair: Option<String>,
    pub direction: Option<String>,
}

#[derive(Debug, Clone)]
struct WorkingPosition {
    wallet: String,
    pair: String,
    direction: PositionDirection,
    opened_at: i64,
    current_size: f64,
    max_size: f64,
    fills: Vec<Fill>,
    events: Vec<ReplayEvent>,
    entry_qty: f64,
    entry_notional: f64,
    open_notional: f64,
    closed_qty: f64,
    closed_notional: f64,
    realized_pnl: f64,
}

pub fn reconstruct_positions(
    wallet: &str,
    fills: &[Fill],
    filter: PositionFilter,
) -> Vec<Position> {
    let mut positions = Vec::new();
    let mut by_pair: std::collections::HashMap<String, Option<WorkingPosition>> =
        std::collections::HashMap::new();

    for fill in fills {
        let entry = by_pair.entry(fill.pair.clone()).or_insert(None);
        process_fill(entry, fill, &mut positions);
    }

    let mut filtered: Vec<Position> = positions
        .into_iter()
        .filter(|p| p.wallet.eq_ignore_ascii_case(wallet))
        .filter(|p| {
            filter
                .pair
                .as_ref()
                .is_none_or(|pair| p.pair.eq_ignore_ascii_case(pair))
        })
        .filter(|p| {
            filter.direction.as_ref().is_none_or(|d| {
                let d = d.to_ascii_lowercase();
                matches!(
                    (&p.direction, d.as_str()),
                    (PositionDirection::Long, "long") | (PositionDirection::Short, "short")
                )
            })
        })
        .collect();

    filtered.sort_by_key(|p| p.opened_at);
    filtered
}

fn process_fill(slot: &mut Option<WorkingPosition>, fill: &Fill, output: &mut Vec<Position>) {
    let delta = signed_delta(fill);
    if delta.abs() < f64::EPSILON {
        return;
    }

    if slot.is_none() {
        if is_definitely_closing_fill(fill) {
            // Range likely starts mid-position. Ignore boundary close-only fills until a clear entry appears.
            return;
        }
        *slot = Some(start_position(fill, delta));
        return;
    }

    let mut pos = slot.take().expect("position expected");
    let old_size = pos.current_size;
    let new_size = old_size + delta;

    if old_size.signum() == new_size.signum() || new_size.abs() < f64::EPSILON {
        apply_fill(&mut pos, fill, delta, new_size);

        if new_size.abs() < 1e-12 {
            output.push(finish_position(pos, fill.timestamp));
        } else {
            *slot = Some(pos);
        }
        return;
    }

    // Fill flipped through zero. Close existing position then open a new one with residual size.
    let closing_delta = -old_size;
    apply_fill(&mut pos, fill, closing_delta, 0.0);
    output.push(finish_position(pos, fill.timestamp));

    let residual = new_size;
    if residual.abs() > 1e-12 {
        let mut next = start_position(fill, residual);
        // We already consumed part of this fill to close the old position.
        if let Some(first) = next.fills.first_mut() {
            first.size = residual.abs();
        }
        if let Some(first_event) = next.events.first_mut() {
            first_event.fill_size = residual.abs();
            first_event.net_size_after = residual;
        }
        *slot = Some(next);
    }
}

fn start_position(fill: &Fill, delta: f64) -> WorkingPosition {
    let direction = if delta > 0.0 {
        PositionDirection::Long
    } else {
        PositionDirection::Short
    };

    WorkingPosition {
        wallet: fill.wallet.clone(),
        pair: fill.pair.clone(),
        direction,
        opened_at: fill.timestamp,
        current_size: delta,
        max_size: delta.abs(),
        fills: vec![fill.clone()],
        events: vec![ReplayEvent {
            timestamp: fill.timestamp,
            event_type: ReplayEventType::Entry,
            fill_price: fill.price,
            fill_size: delta.abs(),
            net_size_after: delta,
        }],
        entry_qty: delta.abs(),
        entry_notional: delta.abs() * fill.price,
        open_notional: delta.abs() * fill.price,
        closed_qty: 0.0,
        closed_notional: 0.0,
        realized_pnl: -fill.fee.abs(),
    }
}

fn apply_fill(pos: &mut WorkingPosition, fill: &Fill, delta: f64, new_size: f64) {
    let avg_entry = if pos.current_size.abs() > 0.0 {
        pos.open_notional / pos.current_size.abs()
    } else {
        0.0
    };

    let was_increasing = pos.current_size.signum() == delta.signum();

    if was_increasing {
        pos.entry_qty += delta.abs();
        pos.entry_notional += delta.abs() * fill.price;
        pos.open_notional += delta.abs() * fill.price;
        pos.events.push(ReplayEvent {
            timestamp: fill.timestamp,
            event_type: ReplayEventType::Add,
            fill_price: fill.price,
            fill_size: delta.abs(),
            net_size_after: new_size,
        });
    } else {
        let closed_qty = delta.abs();
        pos.closed_qty += closed_qty;
        pos.closed_notional += closed_qty * fill.price;

        let pnl = match pos.direction {
            PositionDirection::Long => (fill.price - avg_entry) * closed_qty,
            PositionDirection::Short => (avg_entry - fill.price) * closed_qty,
        };
        pos.realized_pnl += pnl;

        let event_type = if new_size.abs() < 1e-12 {
            ReplayEventType::FullClose
        } else {
            ReplayEventType::PartialClose
        };

        pos.events.push(ReplayEvent {
            timestamp: fill.timestamp,
            event_type,
            fill_price: fill.price,
            fill_size: closed_qty,
            net_size_after: new_size,
        });

        if pos.current_size.abs() > 0.0 {
            let remaining = (pos.current_size.abs() - closed_qty).max(0.0);
            pos.open_notional = avg_entry * remaining;
        }
    }

    pos.current_size = new_size;
    pos.max_size = pos.max_size.max(new_size.abs());
    pos.realized_pnl -= fill.fee.abs();
    pos.fills.push(fill.clone());
}

fn finish_position(pos: WorkingPosition, closed_at: i64) -> Position {
    let avg_entry = if pos.entry_qty > 0.0 {
        pos.entry_notional / pos.entry_qty
    } else {
        0.0
    };

    let avg_exit = if pos.closed_qty > 0.0 {
        pos.closed_notional / pos.closed_qty
    } else {
        0.0
    };

    Position {
        id: position_id(
            &pos.wallet,
            &pos.pair,
            &pos.direction,
            pos.opened_at,
            closed_at,
        ),
        wallet: pos.wallet,
        pair: pos.pair,
        direction: pos.direction,
        opened_at: pos.opened_at,
        closed_at,
        fills: pos.fills,
        events: pos.events,
        max_size: pos.max_size,
        avg_entry: round_8(avg_entry),
        avg_exit: round_8(avg_exit),
        realized_pnl: round_8(pos.realized_pnl),
    }
}

fn signed_delta(fill: &Fill) -> f64 {
    if let Some(dir) = &fill.dir {
        let d = dir.to_ascii_lowercase();
        if d.contains("open long") || d.contains("long >") || d.contains("buy") {
            return fill.size.abs();
        }
        if d.contains("close long") {
            return -fill.size.abs();
        }
        if d.contains("open short") {
            return -fill.size.abs();
        }
        if d.contains("close short") {
            return fill.size.abs();
        }
    }

    // Fallback: side A is ask/sell in Hyperliquid fill payloads.
    if fill.side.eq_ignore_ascii_case("A") {
        -fill.size.abs()
    } else {
        fill.size.abs()
    }
}

fn is_definitely_closing_fill(fill: &Fill) -> bool {
    fill.dir.as_ref().is_some_and(|dir| {
        let d = dir.to_ascii_lowercase();
        d.contains("close long") || d.contains("close short")
    })
}

fn position_id(
    wallet: &str,
    pair: &str,
    direction: &PositionDirection,
    opened_at: i64,
    closed_at: i64,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(wallet.as_bytes());
    hasher.update(pair.as_bytes());
    hasher.update(format!("{:?}", direction));
    hasher.update(opened_at.to_le_bytes());
    hasher.update(closed_at.to_le_bytes());
    hex::encode(hasher.finalize())
}

fn round_8(value: f64) -> f64 {
    (value * 100_000_000.0).round() / 100_000_000.0
}
