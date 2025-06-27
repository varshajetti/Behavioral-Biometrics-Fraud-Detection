import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { BankingDashboard } from "./components/BankingDashboard";
import { DemoDataGenerator } from "./components/DemoDataGenerator";
import { Toaster } from "sonner";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-blue-600">SecureBank</h2>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Authenticated>
        <div className="p-6">
          <DemoDataGenerator />
          <BankingDashboard />
        </div>
      </Authenticated>

      <Unauthenticated>
        <div className="flex flex-col gap-8 max-w-md mx-auto p-8 mt-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">SecureBank</h1>
            <p className="text-xl text-gray-600 mb-2">
              Advanced Behavioral Biometrics
            </p>
            <p className="text-gray-500">
              Protecting your banking with AI-powered fraud detection
            </p>
          </div>
          <SignInForm />
          <div className="text-sm text-gray-500 text-center">
            <p className="mb-2">🔒 Features:</p>
            <ul className="space-y-1">
              <li>• Real-time keystroke analysis</li>
              <li>• Mouse movement pattern detection</li>
              <li>• Navigation behavior monitoring</li>
              <li>• Fraud risk scoring</li>
            </ul>
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
