"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { CheckCircle, UserCheck, CalendarCheck, User, Clock, Sparkles, Users } from "lucide-react";

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

  // États pour la gestion des noms
  const [nomSelectionne, setNomSelectionne] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);
  const [abonnementsActifs, setAbonnementsActifs] = useState([]);
  const [clientsSeances, setClientsSeances] = useState([]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchStats();
    loadClientsData();
  }, [user, router, type]);

  // Fonction pour charger les données des clients selon le type
  const loadClientsData = async () => {
    setLoadingClients(true);
    try {
      if (type === "abonnement") {
        await loadAbonnementsActifs();
      } else {
        await loadClientsSeances();
      }
    } catch (error) {
      console.error("Erreur lors du chargement des clients:", error);
    } finally {
      setLoadingClients(false);
    }
  };

  // Fonction pour récupérer les abonnements actifs
  const loadAbonnementsActifs = async () => {
    try {
      const today = new Date().toISOString();
      
      // Récupérer tous les abonnements d'abord
      const abonnementsQuery = query(
        collection(db, "abonnements"),
        orderBy("createdAt", "desc")
      );
      
      const snapshot = await getDocs(abonnementsQuery);
      const abonnementsActifsData = [];
      
      console.log("Nombre total d'abonnements trouvés:", snapshot.size);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Abonnement:", data);
        
        // Vérifier si l'abonnement est actif
        if (data.nom_client && data.date_debut && data.date_fin) {
          const dateDebut = data.date_debut;
          const dateFin = data.date_fin;
          
          console.log(`Client: ${data.nom_client}, Début: ${dateDebut}, Fin: ${dateFin}, Aujourd'hui: ${today}`);
          
          // Vérifier si l'abonnement est actif (début <= aujourd'hui <= fin)
          if (dateDebut <= today && dateFin >= today) {
            console.log("Abonnement actif trouvé pour:", data.nom_client);
            
            // Éviter les doublons
            const existe = abonnementsActifsData.find(
              client => client.nom.toLowerCase() === data.nom_client.toLowerCase()
            );
            
            if (!existe) {
              abonnementsActifsData.push({
                nom: data.nom_client,
                dateFin: data.date_fin,
                duree: data.duree || "Non spécifié"
              });
            }
          } else {
            console.log("Abonnement expiré ou pas encore commencé pour:", data.nom_client);
          }
        } else {
          console.log("Données incomplètes pour l'abonnement:", data);
        }
      });

      console.log("Abonnements actifs finaux:", abonnementsActifsData);
      setAbonnementsActifs(abonnementsActifsData);
    } catch (error) {
      console.error("Erreur lors de la récupération des abonnements actifs:", error);
      setAbonnementsActifs([]);
    }
  };

  // Fonction pour récupérer les clients de séances fréquents
  const loadClientsSeances = async () => {
    try {
      const seancesQuery = query(
        collection(db, "seances"),
        where("nom_client", "!=", null),
        orderBy("nom_client")
      );
      
      const snapshot = await getDocs(seancesQuery);
      const nomsCount = {};
      
      // Compter les occurrences
      snapshot.forEach(doc => {
        const nomClient = doc.data().nom_client;
        if (nomClient && nomClient.trim()) {
          const nomFormate = nomClient.trim().toLowerCase();
          nomsCount[nomFormate] = (nomsCount[nomFormate] || 0) + 1;
        }
      });
      
      // Trier par fréquence et formater
      const clientsSeancesData = Object.entries(nomsCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15)
        .map(([nom, count]) => ({
          nom: nom.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          count: count
        }));
      
      setClientsSeances(clientsSeancesData);
    } catch (error) {
      console.error("Erreur lors de la récupération des clients séances:", error);
      setClientsSeances([]);
    }
  };

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

  // Fonction pour obtenir le nom final
  const getNomFinal = () => {
    return nomSelectionne;
  };

  const handleMarkPresence = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    
    const nomFinal = getNomFinal();
    
    if (!nomFinal) {
      setMessage("❌ Veuillez sélectionner ou entrer un nom.");
      setIsLoading(false);
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    try {
      if (type === "abonnement") {
        // Vérifier si abonnement actif
        const today = new Date().toISOString();
        const abonnementsQuery = query(
          collection(db, "abonnements"),
          where("nom_client", "==", nomFinal)
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
          setTimeout(() => setMessage(""), 4000);
          return;
        }
      }

      await addDoc(collection(db, "presences"), {
        nom_client: nomFinal,
        date: new Date().toISOString(),
        type,
        createdAt: serverTimestamp(),
      });

      setMessage("✅ Présence enregistrée avec succès !");
      
      // Réinitialiser les champs
      setNomSelectionne("");
      setNouveauNom("");
      setIsNouveauNom(false);
      
      // Recharger les statistiques et les données clients si nécessaire
      fetchStats();
      if (type === "seance" && isNouveauNom && nouveauNom.trim()) {
        loadClientsData();
      }
      
    } catch (error) {
      console.error("Erreur:", error);
      setMessage("❌ Une erreur est survenue. Vérifiez la console.");
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  // Formater la date de fin pour l'affichage
  const formatDateFin = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Calculer les jours restants
  const getJoursRestants = (dateFin) => {
    const aujourdhui = new Date();
    const fin = new Date(dateFin);
    const diffTime = fin - aujourdhui;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Éléments décoratifs d'arrière-plan */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-green-200/30 to-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-100/20 to-pink-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-lg">
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
              <p className="text-gray-500 text-sm">Enregistrement d&apos;une présence</p>
            </div>

            <div className="space-y-6">
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

              {/* Sélection du client */}
              <div className="space-y-4">
                <label className="text-gray-700 font-semibold text-sm flex items-center gap-2">
                  <Users size={16} className="text-gray-500" />
                  Sélection du client
                </label>
                
                <div className="space-y-2">
                  <select
                    className="w-full border-2 text-gray-700 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                    value={nomSelectionne}
                    onChange={(e) => setNomSelectionne(e.target.value)}
                    disabled={isLoading || loadingClients}
                  >
                    <option value="">
                      {loadingClients ? "Chargement..." : `Sélectionnez un ${type === "abonnement" ? "abonné" : "client"}`}
                    </option>
                    {type === "abonnement" ? (
                      abonnementsActifs.map((client, index) => {
                        const joursRestants = getJoursRestants(client.dateFin);
                        return (
                          <option key={index} value={client.nom}>
                            {client.nom} - {client.duree} (expire le {formatDateFin(client.dateFin)})
                            {joursRestants <= 7 && ` - ⚠️ ${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`}
                          </option>
                        );
                      })
                    ) : (
                      clientsSeances.map((client, index) => (
                        <option key={index} value={client.nom}>
                          {client.nom} ({client.count} séance{client.count > 1 ? 's' : ''})
                        </option>
                      ))
                    )}
                  </select>
                  
                  {/* Messages informatifs */}
                  {!loadingClients && (
                    <>
                      {type === "abonnement" && abonnementsActifs.length === 0 && (
                        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                          ⚠️ Aucun abonnement actif trouvé. Vérifiez que des abonnements sont enregistrés et non expirés.
                        </p>
                      )}
                      {type === "seance" && clientsSeances.length === 0 && (
                        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                          Aucun client trouvé. Commencez par enregistrer des paiements de séances.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Information contextuelle */}
              {type === "abonnement" && nomSelectionne && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 text-green-800">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Abonnement vérifié</div>
                      <div className="text-sm text-green-600">
                        Ce client a un abonnement actif et peut marquer sa présence.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bouton d'envoi avec animation de chargement */}
              <button
                type="button"
                onClick={handleMarkPresence}
                disabled={isLoading || !nomSelectionne}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
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
              <div className="text-xs text-gray-600">Présences aujourd&apos;hui</div>
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