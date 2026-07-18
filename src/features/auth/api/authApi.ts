import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  User as FirebaseUser,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, googleProvider, db } from '../../../firebase/config';
import { useAuthStore } from '../store/authStore';
import { Organization, OrganizationMember, User } from '../../../types';
import { getPermissionsForRoles } from '../services/permissions';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    // Rethrow AuthErrors (set by the auth state listener) or other errors
    if (error instanceof AuthError) throw error;
    // Firebase popup errors (dismissed, blocked, etc.)
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw new AuthError('Sign-in was cancelled.');
    }
    console.error('Login error:', error);
    throw new AuthError('Sign-in failed. Please try again.');
  }
};

// ── Email / Password ──────────────────────────────────────────────────────

/** Map Firebase auth error codes to friendly, non-leaky messages. */
const mapAuthError = (code: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/invalid-phone-number':
      return 'That phone number is not valid.';
    case 'auth/invalid-verification-code':
      return 'The verification code is incorrect.';
    case 'auth/code-expired':
      return 'The verification code has expired. Request a new one.';
    default:
      return 'Authentication failed. Please try again.';
  }
};

export const signUpWithEmail = async (name: string, email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) {
      await updateProfile(result.user, { displayName: name.trim() });
    }
    return result.user;
  } catch (error: any) {
    throw new AuthError(mapAuthError(error?.code ?? ''));
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return result.user;
  } catch (error: any) {
    throw new AuthError(mapAuthError(error?.code ?? ''));
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: any) {
    throw new AuthError(mapAuthError(error?.code ?? ''));
  }
};

// ── Phone (SMS OTP) ─────────────────────────────────────────────────────────

/**
 * Create an invisible reCAPTCHA verifier bound to a container element.
 * Firebase requires this before sending an SMS code.
 */
export const createRecaptcha = (containerId: string): RecaptchaVerifier =>
  new RecaptchaVerifier(auth, containerId, { size: 'invisible' });

/**
 * Send an SMS verification code. Returns a ConfirmationResult whose
 * `.confirm(code)` completes the sign-in.
 */
export const startPhoneSignIn = async (
  phoneE164: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> => {
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (error: any) {
    throw new AuthError(mapAuthError(error?.code ?? ''));
  }
};

/** Confirm the SMS code against a prior ConfirmationResult. */
export const confirmPhoneCode = async (
  confirmation: ConfirmationResult,
  code: string,
) => {
  try {
    const result = await confirmation.confirm(code);
    return result.user;
  } catch (error: any) {
    throw new AuthError(mapAuthError(error?.code ?? ''));
  }
};

export const reauthenticateGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Re-authentication error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const buildUserProfile = (firebaseUser: FirebaseUser, userData: Partial<User>): User => ({
  uid: firebaseUser.uid,
  name: userData.name || firebaseUser.displayName || firebaseUser.email || 'Admin',
  email: userData.email || firebaseUser.email || '',
  photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
  role: userData.role || 'user',
  globalStatus: userData.globalStatus || 'active',
  defaultOrganizationId: userData.defaultOrganizationId,
  createdAt: userData.createdAt,
  updatedAt: userData.updatedAt,
  lastLoginAt: Date.now(),
});

const fetchOrganizationMemberships = async (userId: string): Promise<OrganizationMember[]> => {
  const membershipsQuery = query(
    collection(db, 'organizationMembers'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
  );
  const snapshot = await getDocs(membershipsQuery);

  return snapshot.docs.map((membershipDoc) => {
    const data = membershipDoc.data() as Omit<OrganizationMember, 'id'>;
    return {
      ...data,
      id: membershipDoc.id,
      effectivePermissions: data.effectivePermissions?.length
        ? data.effectivePermissions
        : getPermissionsForRoles(data.roleIds),
    };
  });
};

const fetchOrganizationsByMembership = async (
  memberships: OrganizationMember[],
): Promise<Organization[]> => {
  const organizationDocs = await Promise.all(
    memberships.map((membership) => getDoc(doc(db, 'organizations', membership.organizationId))),
  );

  return organizationDocs
    .filter((organizationDoc) => organizationDoc.exists())
    .map((organizationDoc) => ({
      id: organizationDoc.id,
      ...organizationDoc.data(),
    } as Organization))
    .filter((organization) => organization.status === 'active');
};

const ensureAdminBootstrapOrganization = async (
  firebaseUser: FirebaseUser,
  user: User,
): Promise<{ organization: Organization; membership: OrganizationMember }> => {
  const now = Date.now();
  const organizationId = user.defaultOrganizationId || `org_${firebaseUser.uid}`;
  const memberId = `${organizationId}_${firebaseUser.uid}`;
  const organizationRef = doc(db, 'organizations', organizationId);
  const membershipRef = doc(db, 'organizationMembers', memberId);
  const organizationSnapshot = await getDoc(organizationRef);

  const organization: Organization = organizationSnapshot.exists()
    ? ({ id: organizationSnapshot.id, ...organizationSnapshot.data() } as Organization)
    : {
        id: organizationId,
        name: `${user.name}'s Workspace`,
        slug: slugify(`${user.name}-workspace`) || `workspace-${firebaseUser.uid.slice(0, 8)}`,
        description: 'Default EnvVault workspace.',
        createdBy: firebaseUser.uid,
        createdAt: now,
        updatedAt: now,
        billingPlanId: 'free',
        status: 'active',
        security: {
          requireReauthForReveal: true,
          sessionTimeoutMinutes: 60,
          clipboardTimeoutSeconds: 30,
          allowedIpRanges: [],
        },
      };

  if (!organizationSnapshot.exists()) {
    await setDoc(organizationRef, organization);
  }

  const membership: OrganizationMember = {
    id: memberId,
    organizationId,
    userId: firebaseUser.uid,
    email: user.email,
    displayName: user.name,
    roleIds: ['owner'],
    effectivePermissions: getPermissionsForRoles(['owner']),
    status: 'active',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(membershipRef, membership, { merge: true });
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    defaultOrganizationId: organizationId,
    lastLoginAt: now,
    updatedAt: now,
  }, { merge: true });

  return { organization, membership };
};

export const initAuthListener = () => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    const { setSession, setUser, setLoading } = useAuthStore.getState();

    if (firebaseUser) {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        let userData: Partial<User>;
        if (!userDoc.exists()) {
          // Auto-provision user document on first login
          const now = Date.now();
          const newUser: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email || 'Admin',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined,
            role: 'admin',
            globalStatus: 'active',
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(userRef, newUser);
          userData = newUser;
        } else {
          userData = userDoc.data() as Partial<User>;
        }

        const user = buildUserProfile(firebaseUser, userData);

        if (user.globalStatus === 'disabled') {
          await firebaseSignOut(auth);
          setUser(null);
          useAuthStore.getState().setError('Your EnvVault account has been disabled.');
          return;
        }

        if (user.role !== 'admin') {
          // User exists but is not an admin
          await firebaseSignOut(auth);
          setUser(null);
          useAuthStore.getState().setError('You do not have admin privileges to access EnvVault.');
          return;
        }

        let memberships = await fetchOrganizationMemberships(firebaseUser.uid);
        let organizations = await fetchOrganizationsByMembership(memberships);

        if (memberships.length === 0 || organizations.length === 0) {
          const bootstrap = await ensureAdminBootstrapOrganization(firebaseUser, user);
          memberships = [bootstrap.membership];
          organizations = [bootstrap.organization];
        }

        const activeOrganization =
          organizations.find((organization) => organization.id === user.defaultOrganizationId) ||
          organizations[0] ||
          null;

        setSession({ user, activeOrganization, memberships });
        useAuthStore.getState().setError(null);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser(null);
        useAuthStore.getState().setError('An error occurred during authentication. Please try again.');
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  });
};
