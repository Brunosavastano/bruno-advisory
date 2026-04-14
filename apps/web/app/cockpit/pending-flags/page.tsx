import { redirect } from 'next/navigation';

export default function LegacyCockpitPendingFlagsPage() {
  redirect('/cockpit/flags');
}
