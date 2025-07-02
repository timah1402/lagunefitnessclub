"use client";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Link from "next/link";
import { Home, DollarSign, Calendar, FileText, Users, LogOut } from "lucide-react";
import { useAuth } from "./context/AuthContext";

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <MainLayout>{children}</MainLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

function MainLayout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar visible sur toutes les pages */}
      {user && (
        <aside className="w-64 bg-gray-800 text-white flex flex-col">
          <div className="p-6 text-2xl font-bold border-b border-gray-700 flex items-center gap-2">
            <Home /> Gym Admin
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
              <Home size={18} /> Dashboard
            </Link>
            <Link href="/paiements" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
              <DollarSign size={18} /> Paiements
            </Link>
            <Link href="/presences" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
              <Calendar size={18} /> Présences
            </Link>
            <Link href="/rapports" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
              <FileText size={18} /> Rapports
            </Link>
            <Link href="/abonnements" className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded">
              <Users size={18} /> Abonnements
            </Link>
          </nav>
          <button
            onClick={logout}
            className="bg-red-600 m-4 py-2 rounded hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <LogOut /> Déconnexion
          </button>
        </aside>
      )}
      <main className="flex-1 bg-gray-100 overflow-y-auto">{children}</main>
    </div>
  );
}
