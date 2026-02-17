function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`rounded-2xl bg-gray-100 ${className}`} />;
}

export default function InsuranceClaims() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Reports & Insurance | Insurance Claims</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <SkeletonBox className="h-56" />
          <SkeletonBox className="h-56" />
          <SkeletonBox className="h-56" />
        </div>

        <SkeletonBox className="h-56" />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-4">
          <SkeletonBox className="h-[440px]" />
          <div className="space-y-4">
            <SkeletonBox className="h-[220px]" />
            <SkeletonBox className="h-[204px]" />
          </div>
        </div>
      </section>
    </div>
  );
}
