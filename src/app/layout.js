"use client";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Link from "next/link";
import { Home, DollarSign, Calendar, FileText, Users, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { useState } from "react";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay pour mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-800 text-white flex flex-col h-screen
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {user ? (
          <>
            <div className="p-6 text-2xl font-bold border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home /> Gym Admin
              </div>
              {/* Bouton fermer pour mobile */}
              <button 
                onClick={closeSidebar}
                className="lg:hidden p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded transition-colors"
                onClick={closeSidebar}
              >
                <Home size={18} /> Dashboard
              </Link>
              <Link 
                href="/paiements" 
                className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded transition-colors"
                onClick={closeSidebar}
              >
                <DollarSign size={18} /> Paiements
              </Link>
              <Link 
                href="/presences" 
                className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded transition-colors"
                onClick={closeSidebar}
              >
                <Calendar size={18} /> Présences
              </Link>
              <Link 
                href="/rapports" 
                className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded transition-colors"
                onClick={closeSidebar}
              >
                <FileText size={18} /> Rapports
              </Link>
              <Link 
                href="/abonnements" 
                className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded transition-colors"
                onClick={closeSidebar}
              >
                <Users size={18} /> Abonnements
              </Link>
            </nav>
            
            <button
              onClick={async () => {
                await logout();
                window.location.href = "/login";
              }}
              className="bg-red-600 m-4 py-2 rounded hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut /> Déconnexion
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400"></p>
          </div>
        )}
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Header mobile avec bouton menu */}
        {user && (
          <header className="lg:hidden bg-white shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-black"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Gym Admin</h1>
            <div className="w-10"></div> {/* Spacer pour centrer le titre */}
          </header>
        )}

        {/* Contenu principal */}
        <main className="flex-1 bg-gray-100 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}