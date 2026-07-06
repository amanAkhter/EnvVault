import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { Project } from '../../../types';

export const fetchProjects = async (
  organizationId: string,
  includeLegacyProjects = false,
): Promise<Project[]> => {
  const q = query(
    collection(db, 'projects'),
    where('organizationId', '==', organizationId),
    orderBy('updatedAt', 'desc'),
  );
  const querySnapshot = await getDocs(q);
  const scopedProjects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

  if (!includeLegacyProjects) {
    return scopedProjects;
  }

  const legacyQuery = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'));
  const legacySnapshot = await getDocs(legacyQuery);
  const legacyProjects = legacySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Project))
    .filter((project) => !project.organizationId);

  return [...scopedProjects, ...legacyProjects];
};

export const fetchProjectById = async (id: string, organizationId: string): Promise<Project | null> => {
  const docRef = doc(db, 'projects', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const project = { id: docSnap.id, ...docSnap.data() } as Project;
    return !project.organizationId || project.organizationId === organizationId ? project : null;
  }
  return null;
};

export const createProject = async (project: Omit<Project, 'id'>): Promise<Project> => {
  const docRef = doc(collection(db, 'projects'));
  const newProject = { ...project, id: docRef.id };
  await setDoc(docRef, newProject);
  return newProject;
};

export const updateProject = async (id: string, project: Partial<Project>): Promise<void> => {
  const docRef = doc(db, 'projects', id);
  await setDoc(docRef, project, { merge: true });
};

export const deleteProject = async (id: string): Promise<void> => {
  const docRef = doc(db, 'projects', id);
  await deleteDoc(docRef);
};
