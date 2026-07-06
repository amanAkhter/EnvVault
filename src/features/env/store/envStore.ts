import { create } from 'zustand';
import { EnvVariable, ProjectEnvironment } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

interface EnvState {
  development: EnvVariable[];
  production: EnvVariable[];
  isDirty: boolean;
  init: (dev: EnvVariable[], prod: EnvVariable[]) => void;
  addVariable: (env: 'development' | 'production', key?: string, value?: string) => void;
  updateVariable: (env: 'development' | 'production', id: string, data: Partial<EnvVariable>) => void;
  deleteVariable: (env: 'development' | 'production', id: string) => void;
  reorderVariable: (env: 'development' | 'production', id: string, direction: 'up' | 'down') => void;
  importVariables: (env: 'development' | 'production', variables: EnvVariable[], mergeStrategy: 'replace' | 'keep' | 'replace-all') => void;
}

export const useEnvStore = create<EnvState>((set) => ({
  development: [],
  production: [],
  isDirty: false,

  init: (dev, prod) => set({ 
    development: dev ? dev.map(v => ({ ...v, hidden: true })) : [], 
    production: prod ? prod.map(v => ({ ...v, hidden: true })) : [], 
    isDirty: false 
  }),

  addVariable: (env, key = '', value = '') => set((state) => {
    const newVar: EnvVariable = {
      id: uuidv4(),
      key,
      value,
      description: '',
      hidden: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      [env]: [...state[env], newVar],
      isDirty: true
    };
  }),

  updateVariable: (env, id, data) => set((state) => {
    const updated = state[env].map((v) => 
      v.id === id ? { ...v, ...data, updatedAt: Date.now() } : v
    );
    return {
      [env]: updated,
      isDirty: true
    };
  }),

  deleteVariable: (env, id) => set((state) => ({
    [env]: state[env].filter(v => v.id !== id),
    isDirty: true
  })),

  reorderVariable: (env, id, direction) => set((state) => {
    const list = [...state[env]];
    const index = list.findIndex(v => v.id === id);
    if (index === -1) return state;
    if (direction === 'up' && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
    }
    return { [env]: list, isDirty: true };
  }),

  importVariables: (env, variables, mergeStrategy) => set((state) => {
    let current = [...state[env]];
    
    if (mergeStrategy === 'replace-all') {
      current = variables;
    } else {
      variables.forEach(newVar => {
        const existingIndex = current.findIndex(c => c.key === newVar.key);
        if (existingIndex !== -1) {
          if (mergeStrategy === 'replace') {
            current[existingIndex] = { ...current[existingIndex], value: newVar.value, updatedAt: Date.now() };
          }
          // if 'keep', do nothing
        } else {
          current.push(newVar);
        }
      });
    }

    return { [env]: current, isDirty: true };
  })
}));
