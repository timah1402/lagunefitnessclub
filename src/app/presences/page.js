"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { CheckCircle, UserCheck, CalendarCheck, User, Clock, Sparkles } from "lucide-react";

export default function PresencesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [nom, setNom] = useState("");
  const [type, setType] = useState("abonnement");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    today: 0,
    thisMonth: 0,
    loading: true
  });

  if (!user) {
    router.push("/login");
    return null;
  }

  // Fonction pour récupérer les statistiques
  const fetchStats = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // Présences aujourd'hui
      const todayQuery = query(
        collection(db, "presences"),
        where("date", ">=", startOfDay.toISOString()),
        where("date", "<", endOfDay.toISOString())
      );
      const todaySnapshot = await getDocs(todayQuery);

      // Présences ce mois
      const monthQuery = query(
        collection(db, "presences"),
        where("date", ">=", startOfMonth.toISOString()),
        where("date", "<=", endOfMonth.toISOString())
      );
      const monthSnapshot = await getDocs(monthQuery);

      setStats({
        today: todaySnapshot.size,
        thisMonth: monthSnapshot.size,
        loading: false
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  // Charger les statistiques au montage du composant
  useEffect(() => {
    fetchStats();
  }, []);

  const handleMarkPresence = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    
    if (!nom.trim()) {
      setMessage("❌ Veuillez entrer un nom.");
      setIsLoading(false);
      return;
    }

    try {
      if (type === "abonnement") {
        // Vérifier si abonnement actif
        const today = new Date().toISOString();
        const abonnementsQuery = query(
          collection(db, "abonnements"),
          where("nom_client", "==", nom)
        );
        const snapshot = await getDocs(abonnementsQuery);

        let abonnementActif = false;
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data.date_debut <= today &&
            data.date_fin >= today
          ) {
            abonnementActif = true;
          }
        });

        if (!abonnementActif) {
          setMessage("❌ Aucun abonnement actif trouvé pour ce client.");
          setIsLoading(false);
          return;
        }
      }

      await addDoc(collection(db, "presences"), {
        nom_client: nom,
        date: new Date().toISOString(),
        type,
        createdAt: serverTimestamp(),
      });

      setMessage("✅ Présence enregistrée avec succès !");
      setNom("");
      setIsLoading(false);
      
      // Recharger les statistiques après ajout
      fetchStats();
    } catch (error) {
      console.error("Erreur:", error);
      setMessage("❌ Une erreur est survenue. Vérifiez la console.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Éléments décoratifs d'arrière-plan */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-green-200/30 to-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-100/20 to-pink-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          {/* Carte principale avec effet glassmorphism */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-3xl">
            {/* En-tête avec animation */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg transform transition-transform duration-300 hover:rotate-6">
                <CalendarCheck className="text-white" size={28} />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                Marquer une Présence
              </h1>
              <p className="text-gray-500 text-sm">Enregistrez rapidement la présence d'un client</p>
            </div>

            <div className="space-y-6">
              {/* Champ nom avec icône */}
              <div className="space-y-2">
                <label className="text-gray-700 font-semibold text-sm flex items-center gap-2">
                  <User size={16} className="text-gray-500" />
                  Nom du client
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    className="w-full bg-gray-50/50 border-2 border-gray-100 p-4 pl-12 rounded-2xl focus:outline-none focus:border-blue-400 focus:bg-white transition-all duration-300 text-gray-800 placeholder-gray-400"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    disabled={isLoading}
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                </div>
              </div>

              {/* Sélecteur de type avec design moderne */}
              <div className="space-y-3">
                <label className="text-gray-700 font-semibold text-sm flex items-center gap-2">
                  <Clock size={16} className="text-gray-500" />
                  Type de présence
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType("abonnement")}
                    disabled={isLoading}
                    className={`relative p-4 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                      type === "abonnement"
                        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-400 shadow-lg shadow-green-200"
                        : "bg-white/50 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <UserCheck size={20} />
                      <span className="font-semibold text-sm">Abonnement</span>
                    </div>
                    {type === "abonnement" && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setType("seance")}
                    disabled={isLoading}
                    className={`relative p-4 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                      type === "seance"
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-400 shadow-lg shadow-blue-200"
                        : "bg-white/50 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle size={20} />
                      <span className="font-semibold text-sm">Séance</span>
                    </div>
                    {type === "seance" && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    )}
                  </button>
                </div>
              </div>

              {/* Bouton d'envoi avec animation de chargement */}
              <button
                type="button"
                onClick={handleMarkPresence}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Enregistrer la présence</span>
                  </>
                )}
              </button>
            </div>

            {/* Message de feedback avec animation */}
            {message && (
              <div className={`mt-6 p-4 rounded-2xl text-center font-semibold transition-all duration-300 transform animate-pulse ${
                message.startsWith("✅") 
                  ? "bg-green-50 text-green-700 border-2 border-green-200" 
                  : "bg-red-50 text-red-700 border-2 border-red-200"
              }`}>
                <div className="flex items-center justify-center gap-2">
                  {message}
                </div>
              </div>
            )}
          </div>

          {/* Statistiques réelles depuis Firebase */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 text-center border border-white/20">
              <div className="text-2xl font-bold text-blue-600">
                {stats.loading ? (
                  <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                ) : (
                  stats.today
                )}
              </div>
              <div className="text-xs text-gray-600">Présences aujourd'hui</div>
            </div>
            <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 text-center border border-white/20">
              <div className="text-2xl font-bold text-green-600">
                {stats.loading ? (
                  <div className="w-6 h-6 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin mx-auto"></div>
                ) : (
                  stats.thisMonth
                )}
              </div>
              <div className="text-xs text-gray-600">Ce mois-ci</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}