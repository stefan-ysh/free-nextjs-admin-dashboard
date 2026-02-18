import { redirect } from 'next/navigation';

export default async function MobileNotificationsPage() {
  redirect('/workflow/notifications');
}
