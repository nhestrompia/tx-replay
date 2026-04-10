use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug)]
pub enum ApiError {
    BadRequest { code: &'static str, message: String },
    NotFound { code: &'static str, message: String },
    Internal { message: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiErrorBody {
    code: &'static str,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiErrorEnvelope {
    error: ApiErrorBody,
}

impl ApiError {
    pub fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self::BadRequest {
            code,
            message: message.into(),
        }
    }

    pub fn not_found(code: &'static str, message: impl Into<String>) -> Self {
        Self::NotFound {
            code,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            ApiError::BadRequest { code, message } => (StatusCode::BAD_REQUEST, code, message),
            ApiError::NotFound { code, message } => (StatusCode::NOT_FOUND, code, message),
            ApiError::Internal { message } => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", message)
            }
        };

        (
            status,
            Json(ApiErrorEnvelope {
                error: ApiErrorBody { code, message },
            }),
        )
            .into_response()
    }
}
