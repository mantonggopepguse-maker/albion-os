'use client';
import PageError from '@/components/ui/PageError';
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) { return <PageError error={props.error} reset={props.reset} />; }