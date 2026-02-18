import { redirect } from 'next/navigation';

export default async function MobileWorkflowLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect('/workflow/todo');
}
