import { useEffect } from 'react';

export default function Toast({ message, kind = 'info', onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  if (!message) return null;
  return <div className={`toast${kind === 'error' ? ' toast-error' : ''}`}>{message}</div>;
}
