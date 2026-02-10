export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          AsymAudit Dashboard
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Marketing Audit Automation Engine
        </p>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome to AsymAudit</h2>
          <p className="text-gray-700">
            This is the dashboard for your automated marketing audit system. 
            The complete implementation is coming soon.
          </p>
        </div>
      </div>
    </main>
  )
}