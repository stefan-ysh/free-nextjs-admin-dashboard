import { redirect } from 'next/navigation';

export default async function MobileHistoryPage() {
  redirect('/workflow/done');
}
