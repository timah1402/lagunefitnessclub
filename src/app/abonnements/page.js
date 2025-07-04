"use client";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, updateDoc, doc, addDoc, getDoc, setDoc } from "firebase/firestore";
import { Users, Calendar, AlertTriangle, CheckCircle, XCircle, Filter, Search, RefreshCw } from "lucide-react";
import { format, parseISO, differenceInDays, addMonths, addYears } from "date-fns";

export default function AbonnementsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [abonnements, setAbonnements] = useState([]);
  const [filteredAbonnements, setFilteredAbonnements] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");

  // Déplacer la vérification d'authentification dans useEffect
  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    // Ne pas charger les données si l'utilisateur n'est pas authentifié
    if (!user) return;

    const fetchAbonnements = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "abonnements"));
        const items = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAbonnements(items);
        setFilteredAbonnements(items);
      } catch (error) {
        console.error("Erreur lors du chargement:", error);
        setMessage("❌ Erreur lors du chargement des abonnements");
      } finally {
        setLoading(false);
      }
    };

    fetchAbonnements();
  }, [user]);

  // Filtrage et recherche
  useEffect(() => {
    let filtered = abonnements;

    // Recherche par nom
    if (searchTerm) {
      filtered = filtered.filter(a => 
        a.nom_client?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrage par statut
    if (statusFilter !== "tous") {
      const today = new Date();
      filtered = filtered.filter(a => {
        if (!a.date_fin) return false;
        const dateFin = parseISO(a.date_fin);
        const joursRestants = differenceInDays(dateFin, today);
        const estExpire = dateFin < today;
        const expireBientot = !estExpire && joursRestants <= 7;

        switch (statusFilter) {
          case "actif": return !estExpire && !expireBientot;
          case "expire_bientot": return expireBientot;
          case "expire": return estExpire;
          default: return true;
        }
      });
    }

    setFilteredAbonnements(filtered);
  }, [abonnements, searchTerm, statusFilter]);

  // Afficher un loader pendant la vérification d'authentification
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-2 text-gray-600">Redirection...</p>
        </div>
      </div>
    );
  }

  const renouvelerAbonnement = async (abonnement, duree) => {
  setLoading(true);
  const today = new Date();
  const currentDateFin = parseISO(abonnement.date_fin);

  // Calculer la nouvelle date de fin
  let nouvelleDateFin;
  
  // Si l'abonnement est expiré, partir de la date actuelle
  // Sinon, partir de la date de fin actuelle
  if (currentDateFin < today) {
    nouvelleDateFin = duree === "1mois" 
      ? addMonths(today, 1) 
      : addYears(today, 1);
  } else {
    nouvelleDateFin = duree === "1mois"
      ? addMonths(currentDateFin, 1)
      : addYears(currentDateFin, 1);
  }

  const montantRenouvellement = abonnement.montant || 0;
  if (montantRenouvellement <= 0) {
    setMessage(`❌ Montant invalide pour ${abonnement.nom_client}. Impossible de renouveler.`);
    setLoading(false);
    setTimeout(() => setMessage(""), 5000);
    return;
  }
  const nouveauMontant = montantRenouvellement + montantRenouvellement;

  try {
    // 1️⃣ Mettre à jour l'abonnement
    const abonnementRef = doc(db, "abonnements", abonnement.id);
    await updateDoc(abonnementRef, {
      date_fin: nouvelleDateFin.toISOString(),
      montant: nouveauMontant,
    });

    // 2️⃣ Enregistrer la transaction
    await addDoc(collection(db, "transactions"), {
      abonnement_id: abonnement.id,
      nom_client: abonnement.nom_client,
      montant: montantRenouvellement,
      date: new Date().toISOString(),
      type: "renouvellement",
      duree,
      etait_expire: currentDateFin < today, // Nouveau champ pour tracer si c'était expiré
    });

    // 3️⃣ Mettre à jour le rapport
    const jour = today.getDate();
    const mois = today.getMonth() + 1;
    const annee = today.getFullYear();
    const rapportId = `${jour}-${mois}-${annee}`;
    const rapportRef = doc(db, "rapports", rapportId);
    const rapportSnap = await getDoc(rapportRef);

    if (rapportSnap.exists()) {
      const rapportData = rapportSnap.data();

      await updateDoc(rapportRef, {
        total_journalier: (rapportData.total_journalier || 0) + montantRenouvellement,
        total_mensuel: (rapportData.total_mensuel || 0) + montantRenouvellement,
        total_annuel: (rapportData.total_annuel || 0) + montantRenouvellement,
        updatedAt: new Date(),
      });
    } else {
      await setDoc(rapportRef, {
        jour,
        mois,
        annee,
        total_journalier: montantRenouvellement,
        total_mensuel: montantRenouvellement,
        total_annuel: montantRenouvellement,
        createdAt: new Date(),
      });
    }

    // Message différent selon si l'abonnement était expiré ou non
    const messageRenouvellement = currentDateFin < today 
      ? `✅ Abonnement EXPIRÉ de ${abonnement.nom_client} réactivé (+${montantRenouvellement.toLocaleString()} FCFA) !`
      : `✅ Abonnement de ${abonnement.nom_client} renouvelé (+${montantRenouvellement.toLocaleString()} FCFA) !`;
    
    setMessage(messageRenouvellement);
    
    // Recharger les données
    const snap = await getDocs(collection(db, "abonnements"));
    const items = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setAbonnements(items);
    
    setTimeout(() => setMessage(""), 5000);
  } catch (error) {
    console.error("Erreur renouvellement:", error);
    setMessage("❌ Une erreur est survenue lors du renouvellement.");
    setTimeout(() => setMessage(""), 5000);
  } finally {
    setLoading(false);
  }
};

  const getStatusInfo = (abonnement) => {
    if (!abonnement.date_fin) return { text: "Invalide", color: "text-gray-500", bg: "bg-gray-100", icon: XCircle };
    
    const today = new Date();
    const dateFin = parseISO(abonnement.date_fin);
    const joursRestants = differenceInDays(dateFin, today);
    const estExpire = dateFin < today;
    const expireBientot = !estExpire && joursRestants <= 7;

    if (estExpire) {
      return { text: "Expiré", color: "text-red-700", bg: "bg-red-100", icon: XCircle };
    } else if (expireBientot) {
      return { text: `${joursRestants}j restants`, color: "text-orange-700", bg: "bg-orange-100", icon: AlertTriangle };
    } else {
      return { text: "Actif", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle };
    }
  };

  const today = new Date();
  const stats = {
    total: abonnements.length,
    actifs: abonnements.filter(a => {
      if (!a.date_fin) return false;
      const dateFin = parseISO(a.date_fin);
      return dateFin >= today && differenceInDays(dateFin, today) > 7;
    }).length,
    expireBientot: abonnements.filter(a => {
      if (!a.date_fin) return false;
      const dateFin = parseISO(a.date_fin);
      const joursRestants = differenceInDays(dateFin, today);
      return dateFin >= today && joursRestants <= 7;
    }).length,
    expires: abonnements.filter(a => {
      if (!a.date_fin) return false;
      return parseISO(a.date_fin) < today;
    }).length
  };

  

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Gestion des Abonnements
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Total</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Actifs</p>
                  <p className="text-2xl font-bold text-green-700">{stats.actifs}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-sm font-medium">Expire bientôt</p>
                  <p className="text-2xl font-bold text-orange-700">{stats.expireBientot}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-sm font-medium">Expirés</p>
                  <p className="text-2xl font-bold text-red-700">{stats.expires}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Message de notification */}
        {message && (
          <div className={`rounded-xl p-4 border-l-4 ${
            message.startsWith("✅") 
              ? "bg-green-50 border-green-400 text-green-700" 
              : "bg-red-50 border-red-400 text-red-700"
          }`}>
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium">{message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtres et recherche */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="lg:w-64">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="actif">Actifs</option>
                  <option value="expire_bientot">Expire bientôt</option>
                  <option value="expire">Expirés</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table des abonnements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Chargement...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Client</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Date début</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Date fin</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Montant</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Statut</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAbonnements.map((a) => {
                    if (!a.date_debut || !a.date_fin) {
                      return (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td colSpan={6} className="py-4 px-6 text-red-600">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-5 w-5" />
                              Abonnement invalide pour {a.nom_client || "?"} : dates manquantes
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const dateDebut = parseISO(a.date_debut);
                    const dateFin = parseISO(a.date_fin);
                    const statusInfo = getStatusInfo(a);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-medium text-gray-900">{a.nom_client}</div>
                        </td>
                        <td className="py-4 px-6 text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {format(dateDebut, "dd/MM/yyyy")}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {format(dateFin, "dd/MM/yyyy")}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-gray-900">
                            {a.montant?.toLocaleString() || "-"} FCFA
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                            <StatusIcon className="h-4 w-4" />
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => renouvelerAbonnement(a, "1mois")}
                              disabled={loading}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className="h-4 w-4" />
                              +1 mois
                            </button>
                            <button
                              onClick={() => renouvelerAbonnement(a, "1an")}
                              disabled={loading}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className="h-4 w-4" />
                              +1 an
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredAbonnements.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">Aucun abonnement trouvé</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}