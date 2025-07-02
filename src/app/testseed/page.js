"use client";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function TestSeedPage() {
  const handleAddData = async () => {
    try {
      // Abonnement fictif
      await addDoc(collection(db, "abonnements"), {
        nom_client: "Jean Dupont",
        date_debut: new Date("2025-06-01T08:00:00Z").toISOString(),
        date_fin: new Date("2025-07-01T08:00:00Z").toISOString(),
        montant: 20000,
        createdAt: new Date(),
      });

      // Séance fictive
      await addDoc(collection(db, "seances"), {
        nom_client: "Fatou Ndiaye",
        date: new Date("2025-06-29T17:30:00Z").toISOString(),
        montant: 3000,
        createdAt: new Date(),
      });

      // Présences fictives
      await addDoc(collection(db, "presences"), {
        nom_client: "Jean Dupont",
        date: new Date("2025-06-29T17:40:00Z").toISOString(),
        type: "abonnement",
        createdAt: new Date(),
      });

      await addDoc(collection(db, "presences"), {
        nom_client: "Fatou Ndiaye",
        date: new Date("2025-06-29T18:00:00Z").toISOString(),
        type: "seance",
        createdAt: new Date(),
      });

      // Rapport fictif
      await addDoc(collection(db, "rapports"), {
        jour: 29,
        mois: 6,
        annee: 2025,
        total_journalier: 23000,
        total_mensuel: 320000,
        total_annuel: 3800000,
        createdAt: new Date(),
      });

      alert("Données fictives ajoutées !");
    } catch (error) {
      console.error("Erreur lors de l'ajout :", error);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <button
        onClick={handleAddData}
        className="bg-green-600 text-white p-4 rounded hover:bg-green-700"
      >
        Ajouter données fictives
      </button>
    </main>
  );
}
