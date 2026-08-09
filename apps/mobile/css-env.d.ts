// Keep stylesheet imports ambient. This file must not import or export anything;
// otherwise TypeScript treats the wildcard as a module augmentation instead of
// a global declaration.
declare module '*.css';
