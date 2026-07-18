import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMasterKey, wrapDEK, generateEncryptionKey } from '../crypto/encryption';

export const migrateLegacyProjects = async (userId: string, organizationId: string) => {
  const projectsRef = collection(db, 'projects');
  const snapshot = await getDocs(projectsRef);

  const masterKey = await getMasterKey(userId);
  let migratedCount = 0;

  for (const projectDoc of snapshot.docs) {
    const data = projectDoc.data();
    
    // Check if it's a legacy project (has 'envs' array or 'environments' array inside the project doc)
    // New projects have these in subcollections or separate collections, and have organizationId
    if (data.organizationId === organizationId && data.encryptedDEK) {
      continue; // Already migrated or new format
    }

    if (data.userId === userId || !data.organizationId) {
      // It's a legacy project owned by this user
      
      // 1. Generate DEK for the project
      const dek = await generateEncryptionKey();
      const wrappedDEK = await wrapDEK(dek, masterKey);
      
      // 2. Update the project document
      await setDoc(doc(db, 'projects', projectDoc.id), {
        ...data,
        organizationId, // Assign to current org
        encryptedDEK: wrappedDEK.encryptedDEK,
        dekIV: wrappedDEK.iv,
        updatedAt: Date.now(),
        // clean up legacy fields if desired, but we can leave them
      }, { merge: true });

      // 3. Migrate environments if they were stored inline
      const legacyEnvs = data.envs || data.environments || [];
      if (Array.isArray(legacyEnvs)) {
        for (let i = 0; i < legacyEnvs.length; i++) {
          const envName = typeof legacyEnvs[i] === 'string' ? legacyEnvs[i] : legacyEnvs[i].name;
          if (envName) {
            const envId = `${projectDoc.id}-${envName.toLowerCase()}`;
            await setDoc(doc(db, 'environments', envId), {
              projectId: projectDoc.id,
              organizationId,
              name: envName,
              color: '#10b981',
              position: i,
              createdBy: userId,
              updatedBy: userId,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }
      }

      migratedCount++;
    }
  }
  
  return migratedCount;
};
