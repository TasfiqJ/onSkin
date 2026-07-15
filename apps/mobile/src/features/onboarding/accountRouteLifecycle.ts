export type AccountRouteRequestPublication = Readonly<{
  currentRequestId: number | null;
  focused: boolean;
  mounted: boolean;
  ownerCurrent: boolean;
  requestId: number;
  requestSequence: number;
}>;

export function canPublishAccountRouteRequest({
  currentRequestId,
  focused,
  mounted,
  ownerCurrent,
  requestId,
  requestSequence,
}: AccountRouteRequestPublication): boolean {
  return (
    mounted &&
    focused &&
    ownerCurrent &&
    requestSequence === requestId &&
    currentRequestId === requestId
  );
}
