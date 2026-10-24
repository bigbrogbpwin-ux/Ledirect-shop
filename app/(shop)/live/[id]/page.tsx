import { LiveRoom } from "../room";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return LiveRoom({ params });
}
