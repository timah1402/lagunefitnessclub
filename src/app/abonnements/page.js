"use client";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, updateDoc, doc, addDoc, getDoc, setDoc } from "firebase/firestore";
import { Users, Calendar, AlertTriangle, CheckCircle, XCircle, Filter, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
    setCurrentPage(1); // Réinitialiser à la première page lors du filtrage
  }, [abonnements, searchTerm, statusFilter]);

  // Calculs de pagination
  const totalPages = Math.ceil(filteredAbonnements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredAbonnements.slice(startIndex, endIndex);

  // Fonctions de navigation
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-2 sm:p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="text-white h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Gestion des Abonnements
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-xs sm:text-sm font-medium">Total</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-700">{stats.total}</p>
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-xs sm:text-sm font-medium">Actifs</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-700">{stats.actifs}</p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-3 sm:p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-xs sm:text-sm font-medium">Expire bientôt</p>
                  <p className="text-lg sm:text-2xl font-bold text-orange-700">{stats.expireBientot}</p>
                </div>
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-3 sm:p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-xs sm:text-sm font-medium">Expirés</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-700">{stats.expires}</p>
                </div>
                <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 text-gray-500 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="sm:w-48 lg:w-64">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-black pl-8 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="actif">Actifs</option>
                  <option value="expire_bientot">Expire bientôt</option>
                  <option value="expire">Expirés</option>
                </select>
              </div>
            </div>

            {/* Sélecteur d'éléments par page */}
            <div className="sm:w-32">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full
               px-3 py-2 text-sm sm:text-base border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
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
            <>
              {/* Table pour écrans moyens et grands */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-4 lg:px-6 font-semibold text-gray-900 text-sm lg:text-base">Client</th>
                      <th className="text-left py-4 px-4 lg:px-6 font-semibold text-gray-900 text-sm lg:text-base">Date début</th>
                      <th className="text-left py-4 px-4 lg:px-6 font-semibold text-gray-900 text-sm lg:text-base">Date fin</th>
                      <th className="text-left py-4 px-4 lg:px-6 font-semibold text-gray-900 text-sm lg:text-base">Montant</th>
                      <th className="text-left py-4 px-4 lg:px-6 font-semibold text-gray-900 text-sm lg:text-base">Statut</th>
                      <th className="text-left py-4 px-4 lg:px-6 font-semibold text-gray-900 text-sm lg:text-base">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((a) => {
                      if (!a.date_debut || !a.date_fin) {
                        return (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td colSpan={6} className="py-4 px-4 lg:px-6 text-red-600">
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
                          <td className="py-4 px-4 lg:px-6">
                            <div className="font-medium text-gray-900 text-sm lg:text-base">{a.nom_client}</div>
                          </td>
                          <td className="py-4 px-4 lg:px-6 text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm lg:text-base">{format(dateDebut, "dd/MM/yyyy")}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 lg:px-6 text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm lg:text-base">{format(dateFin, "dd/MM/yyyy")}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 lg:px-6">
                            <span className="font-semibold text-gray-900 text-sm lg:text-base">
                              {a.montant?.toLocaleString() || "-"} FCFA
                            </span>
                          </td>
                          <td className="py-4 px-4 lg:px-6">
                            <span className={`inline-flex items-center gap-2 px-2 lg:px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                              <StatusIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                              {statusInfo.text}
                            </span>
                          </td>
                          <td className="py-4 px-4 lg:px-6">
                            <div className="flex flex-col xl:flex-row gap-2">
                              <button
                                onClick={() => renouvelerAbonnement(a, "1mois")}
                                disabled={loading}
                                className="inline-flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1 lg:py-2 text-xs lg:text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className="h-3 w-3 lg:h-4 lg:w-4" />
                                +1 mois
                              </button>
                              <button
                                onClick={() => renouvelerAbonnement(a, "1an")}
                                disabled={loading}
                                className="inline-flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1 lg:py-2 text-xs lg:text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className="h-3 w-3 lg:h-4 lg:w-4" />
                                +1 an
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards pour mobile */}
              <div className="md:hidden">
                <div className="divide-y divide-gray-200">
                  {currentItems.map((a) => {
                    if (!a.date_debut || !a.date_fin) {
                      return (
                        <div key={a.id} className="p-4 bg-red-50">
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-5 w-5" />
                            <span className="text-sm">Abonnement invalide pour {a.nom_client || "?"}</span>
                          </div>
                        </div>
                      );
                    }

                    const dateDebut = parseISO(a.date_debut);
                    const dateFin = parseISO(a.date_fin);
                    const statusInfo = getStatusInfo(a);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <div key={a.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{a.nom_client}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.text}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Date début</p>
                           <p className="font-medium text-gray-600">{format(dateDebut, "dd/MM/yyyy")}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Date fin</p>
                            <p className="font-medium  text-gray-600">{format(dateFin, "dd/MM/yyyy")}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm">Montant</p>
                            <p className="font-semibold text-gray-900">{a.montant?.toLocaleString() || "-"} FCFA</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => renouvelerAbonnement(a, "1mois")}
                              disabled={loading}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              +1 mois
                            </button>
                            <button
                              onClick={() => renouvelerAbonnement(a, "1an")}
                              disabled={loading}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              +1 an
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {currentItems.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">Aucun abonnement trouvé</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredAbonnements.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700">
                Affichage de {startIndex + 1} à {Math.min(endIndex, filteredAbonnements.length)} sur {filteredAbonnements.length} résultats
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevious}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {/* Première page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => goToPage(1)}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        1
                      </button>
                      {currentPage > 4 && <span className="px-2 text-gray-500">...</span>}
                    </>
                  )}
                  
                  {/* Pages autour de la page actuelle */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    if (pageNumber < 1 || pageNumber > totalPages) return null;
                    
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => goToPage(pageNumber)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNumber
                            ? "bg-blue-600 text-white"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  
                  {/* Dernière page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={goToNext}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}