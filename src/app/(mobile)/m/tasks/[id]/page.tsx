import { redirect } from 'next/navigation';

export default async function MobileTaskDetailPage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect('/workflow/todo');
}
