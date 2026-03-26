import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DisplayPage() {
  // La page d'affichage est accessible via /display/[serviceId]
  // Sans serviceId, on redirige vers l'admin
  redirect('/admin');
}
