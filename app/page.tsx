import CircuitCanvas from "@/components/CircuitCanvas";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Ohmline Circuit Designer</h1>
        <CircuitCanvas />
      </div>
    </main>
  );
}
