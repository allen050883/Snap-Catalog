import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth } from '@/lib/firebase';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
  }, []);

  return { user, initializing };
}
