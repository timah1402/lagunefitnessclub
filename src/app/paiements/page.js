"use client";
import { useState, useEffect } from "react";
import { CreditCard, User, CalendarDays, CheckCircle, Sparkles, TrendingUp, Clock, DollarSign, Plus, UserCheck } from "lucide-react";
import { db } from "../lib/firebase"; // Ajustez le chemin selon votre structure
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, query, where, getDocs, limit, orderBy } from "firebase/firestore";

export default function PaiementsPage() {
  const [type, setType] = useState("abonnement");
  const [nom, setNom] = useState("");
  const [montant, setMontant] = useState("");
  const [montantCustom, setMontantCustom] = useState("");
  const [isCustomMontant, setIsCustomMontant] = useState(false);
  const [duree, setDuree] = useState("1mois");
  const [dateSeance, setDateSeance] = useState(new Date().toISOString().split('T')[0]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Nouveaux états pour la gestion des noms
  const [nomsFrequents, setNomsFrequents] = useState([]);
  const [isNouveauNom, setIsNouveauNom] = useState(false);
  const [nomSelectionne, setNomSelectionne] = useState("");
  const [nouveauNom, setNouveauNom] = useState("");
  const [loadingNoms, setLoadingNoms] = useState(false);

  // Options de prix prédéfinis
  const prixAbonnements = [
    { value: "15000", label: "15 000 FCFA" },
    { value: "20000", label: "20 000 FCFA" },
    { value: "custom", label: "Montant personnalisé" }
  ];

  const prixSeances = [
    { value: "1000", label: "1 000 FCFA" },
    { value: "1500", label: "1 500 FCFA" },
    { value: "custom", label: "Montant personnalisé" }
  ];

  // Fonction pour récupérer les noms fréquents
  const getNomsFrequents = async () => {
    if (type !== "seance") return;
    
    setLoadingNoms(true);
    try {
      const seancesQuery = query(
        collection(db, "seances"),
        where("nom_client", "!=", null),
        orderBy("nom_client")
      );
      
      const seancesSnapshot = await getDocs(seancesQuery);
      const nomsCount = {};
      
      seancesSnapshot.forEach(doc => {
        const nomClient = doc.data().nom_client;
        if (nomClient && nomClient.trim()) {
          const nomFormate = nomClient.trim().toLowerCase();
          nomsCount[nomFormate] = (nomsCount[nomFormate] || 0) + 1;
        }
      });
      
      const nomsTriés = Object.entries(nomsCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([nom, count]) => ({
          nom: nom.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          count: count
        }));
      
      setNomsFrequents(nomsTriés);
    } catch (error) {
      console.error("Erreur lors de la récupération des noms fréquents:", error);
    } finally {
      setLoadingNoms(false);
    }
  };

  useEffect(() => {
    if (type === "seance") {
      getNomsFrequents();
    }
  }, [type]);

  const enregistrerPresence = async (nomClient, typePresence) => {
    try {
      await addDoc(collection(db, "presences"), {
        nom_client: nomClient,
        date: new Date().toISOString(),
        type: typePresence,
        createdAt: serverTimestamp(),
        auto_generated: true
      });
      console.log("Présence automatique enregistrée pour:", nomClient);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la présence automatique:", error);
    }
  };

  const updateReports = async (paiementData, montantPaye) => {
    const now = new Date();
    const mois = now.getMonth() + 1;
    const annee = now.getFullYear();
    const jour = now.getDate();
    
    const reportId = `${jour}-${mois}-${annee}`;
    const rapportRef = doc(db, "rapports", reportId);
    
    try {
      const rapportDoc = await getDoc(rapportRef);
      
      if (rapportDoc.exists()) {
        const currentData = rapportDoc.data();
        
        const updatedData = {
          total_journalier: (currentData.total_journalier || 0) + montantPaye,
          total_mensuel: (currentData.total_mensuel || 0) + montantPaye,
          total_annuel: (currentData.total_annuel || 0) + montantPaye,
          updatedAt: serverTimestamp(),
        };
        
        await updateDoc(rapportRef, updatedData);
        console.log("Rapport mis à jour:", reportId);
      } else {
        const newRapportData = {
          jour: jour,
          mois: mois,
          annee: annee,
          total_journalier: montantPaye,
          total_mensuel: montantPaye,
          total_annuel: montantPaye,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(rapportRef, newRapportData);
        console.log("Nouveau rapport créé:", reportId);
      }
      
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du rapport:", error);
      throw error;
    }
  };

  const savePaiement = async (paiementData) => {
    const collectionName = type === "abonnement" ? "abonnements" : "seances";
    const docRef = await addDoc(collection(db, collectionName), paiementData);
    return docRef;
  };

  const getNomFinal = () => {
    if (type === "abonnement") {
      return nom.trim() || null;
    } else {
      if (isNouveauNom) {
        return nouveauNom.trim() || null;
      } else {
        return nomSelectionne || null;
      }
    }
  };

  const getMontantFinal = () => {
    if (isCustomMontant) {
      return parseInt(montantCustom) || 0;
    } else {
      return parseInt(montant) || 0;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const montantFinal = getMontantFinal();
    
    if (!montantFinal || montantFinal <= 0) {
      setMessage("❌ Veuillez entrer un montant valide");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const nomFinal = getNomFinal();
      
      const paiementData = {
        type: type,
        nom_client: nomFinal,
        montant: montantFinal,
        devise: "FCFA",
        createdAt: serverTimestamp(),
        statut: "payé"
      };

      if (type === "abonnement") {
        paiementData.duree = duree;
        const dateDebut = new Date();
        const dateFin = new Date(Date.now() + (duree === "1an" ? 365 : 30) * 24 * 60 * 60 * 1000);
        
        paiementData.date_debut = dateDebut.toISOString();
        paiementData.date_fin = dateFin.toISOString();
      } else if (type === "seance") {
        const seanceDate = new Date(dateSeance);
        paiementData.date = seanceDate.toISOString();
      }

      const docRef = await savePaiement(paiementData);
      console.log("Paiement enregistré avec l'ID:", docRef.id);
      
      await updateReports(paiementData, montantFinal);
      
      if (nomFinal) {
        await enregistrerPresence(nomFinal, type);
      }
      
      if (type === "abonnement") {
        setMessage("✅ Abonnement enregistré, rapport mis à jour et présence marquée automatiquement !");
      } else {
        setMessage("✅ Paiement séance enregistré, rapport mis à jour et présence marquée automatiquement !");
      }
      
      setNom("");
      setMontant("");
      setMontantCustom("");
      setIsCustomMontant(false);
      setDuree("1mois");
      setDateSeance(new Date().toISOString().split('T')[0]);
      setNomSelectionne("");
      setNouveauNom("");
      setIsNouveauNom(false);
      
      if (type === "seance" && isNouveauNom && nouveauNom.trim()) {
        getNomsFrequents();
      }
      
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      setMessage("❌ Erreur lors de l'enregistrement: " + error.message);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-3 flex items-center justify-center relative overflow-hidden">
      {/* Message de succès */}
      {message && (
        <div className="fixed top-3 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className={`p-3 rounded-xl text-center font-semibold flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm transition-all duration-500 transform ${
            message.startsWith("✅") 
              ? "bg-green-100/90 text-green-800 border-2 border-green-200 animate-slideDown" 
              : "bg-red-100/90 text-red-800 border-2 border-red-200 animate-slideDown"
          }`}>
            {message.startsWith("✅") ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <span className="text-red-600">❌</span>
            )}
            <span className="text-sm">{message}</span>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-4xl h-full max-h-[95vh]">
        {/* Carte principale optimisée */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden h-full flex flex-col">
          {/* Header compact */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 p-4 text-white relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold">Gestion des Paiements</h1>
              </div>
              <p className="text-blue-100 text-sm">Enregistrez facilement vos abonnements et séances</p>
              <div className="mt-1 text-xs text-blue-200 bg-white/10 px-2 py-0.5 rounded-full inline-block">
                📊 Présence automatique + Rapports
              </div>
            </div>
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-white/30" />
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sélecteur de type compact */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  Type de paiement
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType("abonnement")}
                    className={`group relative p-3 rounded-xl border-2 transition-all duration-300 ${
                      type === "abonnement"
                        ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-md scale-105"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <div className={`p-2 rounded-lg transition-colors ${
                        type === "abonnement" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-sm text-gray-800">Abonnement</div>
                        <div className="text-xs text-gray-500">Mensuel/Annuel</div>
                      </div>
                    </div>
                    {type === "abonnement" && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("seance")}
                    className={`group relative p-3 rounded-xl border-2 transition-all duration-300 ${
                      type === "seance"
                        ? "border-purple-500 bg-gradient-to-br from-purple-50 to-teal-50 shadow-md scale-105"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <div className={`p-2 rounded-lg transition-colors ${
                        type === "seance" ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-sm text-gray-800">Séance</div>
                        <div className="text-xs text-gray-500">Ponctuel</div>
                      </div>
                    </div>
                    {type === "seance" && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Grille pour optimiser l'espace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date pour séance */}
                {type === "seance" && (
                  <div className="space-y-1">
                    <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-gray-500" />
                      Date de la séance
                    </label>
                    <input
                      type="date"
                      className="w-full border-2 text-gray-500 text-sm border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50 focus:bg-white"
                      value={dateSeance}
                      onChange={(e) => setDateSeance(e.target.value)}
                    />
                  </div>
                )}

                {/* Nom du client */}
                {type === "abonnement" ? (
                  <div className="space-y-1">
                    <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-500" />
                      Nom du client
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Ndeye Seck"
                      className="w-full border-2 text-gray-500 text-sm border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-500" />
                      Nom du client
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsNouveauNom(false)}
                        className={`p-2 rounded-lg border transition-all text-xs flex items-center justify-center gap-1 ${
                          !isNouveauNom 
                            ? "border-blue-500 bg-blue-50 text-blue-700" 
                            : "border-gray-200 bg-white text-gray-600"
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />
                        Habituel
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNouveauNom(true)}
                        className={`p-2 rounded-lg border transition-all text-xs flex items-center justify-center gap-1 ${
                          isNouveauNom 
                            ? "border-green-500 bg-green-50 text-green-700" 
                            : "border-gray-200 bg-white text-gray-600"
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        Nouveau
                      </button>
                    </div>

                    {!isNouveauNom ? (
                      <select
                        className="w-full border-2 text-gray-500 text-sm border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                        value={nomSelectionne}
                        onChange={(e) => setNomSelectionne(e.target.value)}
                      >
                        <option value="">Sélectionnez un client</option>
                        {loadingNoms ? (
                          <option disabled>Chargement...</option>
                        ) : (
                          nomsFrequents.map((client, index) => (
                            <option key={index} value={client.nom}>
                              {client.nom} ({client.count})
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ex: Ndeye seck"
                        className="w-full border-2 text-gray-500 text-sm border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 focus:bg-white"
                        value={nouveauNom}
                        onChange={(e) => setNouveauNom(e.target.value)}
                      />
                    )}
                  </div>
                )}

                {/* Durée pour abonnement */}
                {type === "abonnement" && (
                  <div className="space-y-1">
                    <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      Durée
                    </label>
                    <select
                      className="w-full border-2 text-gray-500 text-sm border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50 focus:bg-white"
                      value={duree}
                      onChange={(e) => setDuree(e.target.value)}
                    >
                      <option value="1mois">1 mois</option>
                      <option value="1an">1 an</option>
                    </select>
                  </div>
                )}

                {/* Montant */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-gray-500" />
                    Montant (FCFA) *
                  </label>
                  
                  <select
                    className="w-full border-2 text-gray-500 text-sm border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 focus:bg-white"
                    value={isCustomMontant ? "custom" : montant}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setIsCustomMontant(true);
                        setMontant("");
                      } else {
                        setIsCustomMontant(false);
                        setMontant(e.target.value);
                        setMontantCustom("");
                      }
                    }}
                  >
                    <option value="">Sélectionnez un montant</option>
                    {(type === "abonnement" ? prixAbonnements : prixSeances).map((prix, index) => (
                      <option key={index} value={prix.value}>
                        {prix.label}
                      </option>
                    ))}
                  </select>

                  {isCustomMontant && (
                    <div className="relative mt-2">
                      <input
                        type="number"
                        placeholder="Montant personnalisé"
                        className="w-full text-gray-500 text-sm border-2 border-gray-200 p-2.5 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 focus:bg-white pr-12"
                        value={montantCustom}
                        onChange={(e) => setMontantCustom(e.target.value)}
                        required
                        min="1"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium">
                        FCFA
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info automatisation compacte */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Automatisation complète</div>
                    <div className="text-xs text-blue-600">
                      Paiement + Rapport + Présence automatique
                    </div>
                  </div>
                </div>
              </div>

              {/* Bouton compact */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full p-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Enregistrer Paiement + Présence
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-100px) translateX(-50%);
          }
          to {
            opacity: 1;
            transform: translateY(0) translateX(-50%);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}