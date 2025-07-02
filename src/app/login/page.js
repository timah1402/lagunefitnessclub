"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user } = useAuth();

  // ✅ Déplace la redirection dans useEffect pour éviter l'erreur
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err) {
      setError("Email ou mot de passe incorrect");
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      {user ? (
        // ✅ Message pendant la redirection
        <p>Redirection en cours...</p>
      ) : (
        <div className="w-full max-w-sm bg-white p-8 rounded shadow">
          <h1 className="text-2xl font-bold mb-6 text-center">Connexion Admin</h1>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={handleLogin}>
            <input
              type="email"
              className="w-full border p-2 mb-4 rounded"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full border p-2 mb-4 rounded"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
            >
              Se connecter
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
