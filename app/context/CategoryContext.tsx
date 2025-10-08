// src/context/CategoryContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CategoryContextValue {
  categoryIndex: number;
  setCategoryIndex: (index: number) => void;
}

const CategoryContext = createContext<CategoryContextValue | undefined>(
  undefined
);

export const CategoryProvider = ({ children }: { children: ReactNode }) => {
  const [categoryIndex, setCategoryIndex] = useState(0);

  return (
    <CategoryContext.Provider value={{ categoryIndex, setCategoryIndex }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => {
  const ctx = useContext(CategoryContext);
  if (!ctx)
    throw new Error('useCategory must be used within a CategoryProvider');
  return ctx;
};
