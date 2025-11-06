// Loading skeleton component
import { motion } from 'framer-motion';

export function Skeleton({ className = '', width = '100%', height = '1rem' }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width="120px" height="1.5rem" />
        <Skeleton width="80px" height="1.5rem" />
      </div>
      <div className="space-y-3 mb-4">
        <Skeleton width="100%" height="1rem" />
        <Skeleton width="80%" height="1rem" />
        <Skeleton width="90%" height="1rem" />
        <Skeleton width="70%" height="1rem" />
      </div>
      <div className="flex space-x-2">
        <Skeleton width="100%" height="2.5rem" />
        <Skeleton width="100%" height="2.5rem" />
      </div>
    </div>
  );
}

export function EscrowCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
      <CardSkeleton />
    </motion.div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <Skeleton width="60px" height="3rem" className="mb-2" />
          <Skeleton width="100px" height="1rem" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;

