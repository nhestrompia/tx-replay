import { ReplayView } from "@/components/replay/replay-view"

type ReplayPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ wallet?: string; from?: string; to?: string }>
}

export default async function ReplayPage({ params, searchParams }: ReplayPageProps) {
  const { id } = await params
  const query = await searchParams

  return (
    <ReplayView
      id={id}
      wallet={query.wallet ?? ""}
      from={Number(query.from ?? 0)}
      to={Number(query.to ?? 0)}
    />
  )
}
