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
      // Récupérer tous les paiements de séances
      const seancesQuery = query(
        collection(db, "seances"),
        where("nom_client", "!=", null),
        orderBy("nom_client")
      );
      
      const seancesSnapshot = await getDocs(seancesQuery);
      const nomsCount = {};
      
      // Compter les occurrences de chaque nom
      seancesSnapshot.forEach(doc => {
        const nomClient = doc.data().nom_client;
        if (nomClient && nomClient.trim()) {
          const nomFormate = nomClient.trim().toLowerCase();
          nomsCount[nomFormate] = (nomsCount[nomFormate] || 0) + 1;
        }
      });
      
      // Trier par fréquence et prendre les 10 plus fréquents
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

  // Charger les noms fréquents quand le type change vers "seance"
  useEffect(() => {
    if (type === "seance") {
      getNomsFrequents();
    }
  }, [type]);

  // Fonction pour enregistrer automatiquement la présence
  const enregistrerPresence = async (nomClient, typePresence) => {
    try {
      await addDoc(collection(db, "presences"), {
        nom_client: nomClient,
        date: new Date().toISOString(),
        type: typePresence,
        createdAt: serverTimestamp(),
        auto_generated: true // Flag pour indiquer que c'est automatique
      });
      console.log("Présence automatique enregistrée pour:", nomClient);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la présence automatique:", error);
      // Ne pas faire échouer le paiement si la présence échoue
    }
  };

  // Fonction pour mettre à jour les rapports
  const updateReports = async (paiementData, montantPaye) => {
    const now = new Date();
    const mois = now.getMonth() + 1;
    const annee = now.getFullYear();
    const jour = now.getDate();
    
    // ID du rapport mensuel
    const reportId = `${jour}-${mois}-${annee}`;
    const rapportRef = doc(db, "rapports", reportId);
    
    try {
      // Vérifier si le rapport existe déjà
      const rapportDoc = await getDoc(rapportRef);
      
      if (rapportDoc.exists()) {
        // Mettre à jour le rapport existant
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
        // Créer un nouveau rapport
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

  // Fonction pour enregistrer dans les collections de paiements
  const savePaiement = async (paiementData) => {
    const collectionName = type === "abonnement" ? "abonnements" : "seances";
    const docRef = await addDoc(collection(db, collectionName), paiementData);
    return docRef;
  };

  // Fonction pour obtenir le nom final à utiliser
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

  // Fonction pour obtenir le montant final
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
    
    // Validation
    if (!montantFinal || montantFinal <= 0) {
      setMessage("❌ Veuillez entrer un montant valide");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const nomFinal = getNomFinal();
      
      // Préparer les données à enregistrer
      const paiementData = {
        type: type,
        nom_client: nomFinal,
        montant: montantFinal,
        devise: "FCFA",
        createdAt: serverTimestamp(),
        statut: "payé"
      };

      // Ajouter des champs spécifiques selon le type
      if (type === "abonnement") {
        paiementData.duree = duree;
        const dateDebut = new Date();
        const dateFin = new Date(Date.now() + (duree === "1an" ? 365 : 30) * 24 * 60 * 60 * 1000);
        
        paiementData.date_debut = dateDebut.toISOString();
        paiementData.date_fin = dateFin.toISOString();
      } else if (type === "seance") {
        // Pour les séances, utiliser la date sélectionnée
        const seanceDate = new Date(dateSeance);
        paiementData.date = seanceDate.toISOString();
      }

      // 1. Enregistrer le paiement
      const docRef = await savePaiement(paiementData);
      console.log("Paiement enregistré avec l'ID:", docRef.id);
      
      // 2. Mettre à jour les rapports
      await updateReports(paiementData, montantFinal);
      
      // 3. Enregistrer automatiquement la présence si un nom est fourni
      if (nomFinal) {
        await enregistrerPresence(nomFinal, type);
      }
      
      // Message de succès
      if (type === "abonnement") {
        setMessage("✅ Abonnement enregistré, rapport mis à jour et présence marquée automatiquement !");
      } else {
        setMessage("✅ Paiement séance enregistré, rapport mis à jour et présence marquée automatiquement !");
      }
      
      // Réinitialiser le formulaire
      setNom("");
      setMontant("");
      setMontantCustom("");
      setIsCustomMontant(false);
      setDuree("1mois");
      setDateSeance(new Date().toISOString().split('T')[0]);
      setNomSelectionne("");
      setNouveauNom("");
      setIsNouveauNom(false);
      
      // Recharger les noms fréquents si c'était un nouveau nom
      if (type === "seance" && isNouveauNom && nouveauNom.trim()) {
        getNomsFrequents();
      }
      
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      setMessage("❌ Erreur lors de l'enregistrement: " + error.message);
    } finally {
      setIsSubmitting(false);
      
      // Effacer le message après 5 secondes
      setTimeout(() => setMessage(""), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-100 p-4 flex items-center justify-center relative">
      {/* Message de succès en haut de l'écran */}
      {message && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className={`p-4 rounded-xl text-center font-semibold flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm transition-all duration-500 transform ${
            message.startsWith("✅") 
              ? "bg-green-100/90 text-green-800 border-2 border-green-200 animate-slideDown" 
              : "bg-red-100/90 text-red-800 border-2 border-red-200 animate-slideDown"
          }`}>
            {message.startsWith("✅") ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <span className="text-red-600">❌</span>
            )}
            {message}
          </div>
        </div>
      )}

      

      <div className="relative w-full max-w-2xl">
        {/* Carte principale avec effet glassmorphism */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header avec gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold">Gestion des Paiements</h1>
              </div>
              <p className="text-blue-100 text-lg">Enregistrez facilement vos abonnements et séances</p>
              <div className="mt-2 text-sm text-blue-200 bg-white/10 px-3 py-1 rounded-full inline-block">
                📊 Présence automatique + Mise à jour des rapports
              </div>
            </div>
            <Sparkles className="absolute top-4 right-4 w-6 h-6 text-white/30" />
            <Sparkles className="absolute bottom-8 right-8 w-4 h-4 text-white/20" />
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Sélecteur de type avec animation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Type de paiement
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setType("abonnement")}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                      type === "abonnement"
                        ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg scale-105"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-3">
                      <div className={`p-3 rounded-xl transition-colors ${
                        type === "abonnement" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                      }`}>
                        <CalendarDays className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">Abonnement</div>
                        <div className="text-sm text-gray-500">Engagement mensuel ou annuel</div>
                      </div>
                    </div>
                    {type === "abonnement" && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("seance")}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                      type === "seance"
                        ? "border-purple-500 bg-gradient-to-br from-purple-50 to-teal-50 shadow-lg scale-105"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-3">
                      <div className={`p-3 rounded-xl transition-colors ${
                        type === "seance" ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                      }`}>
                        <User className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">Séance</div>
                        <div className="text-sm text-gray-500">Paiement ponctuel</div>
                      </div>
                    </div>
                    {type === "seance" && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Champs du formulaire */}
              <div className="space-y-6">
                {type === "seance" && (
                  <div className="space-y-2">
                    <label className="text-gray-700 font-semibold flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-gray-500" />
                      Date de la séance
                    </label>
                    <input
                      type="date"
                      className="w-full border-2 text-gray-500 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all bg-gray-50 focus:bg-white"
                      value={dateSeance}
                      onChange={(e) => setDateSeance(e.target.value)}
                    />
                  </div>
                )}

                {/* Gestion du nom - différent selon le type */}
                {type === "abonnement" ? (
                  <div className="space-y-2">
                    <label className="text-gray-700 font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      Nom du client
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Ndeye Seck"
                      className="w-full border-2 text-gray-500 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-gray-700 font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      Nom du client
                    </label>
                    
                    {/* Boutons de choix */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsNouveauNom(false)}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-2 ${
                          !isNouveauNom 
                            ? "border-blue-500 bg-blue-50 text-blue-700" 
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <UserCheck className="w-4 h-4" />
                        <span className="text-sm font-medium">Client habituel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNouveauNom(true)}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-2 ${
                          isNouveauNom 
                            ? "border-green-500 bg-green-50 text-green-700" 
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Nouveau client</span>
                      </button>
                    </div>

                    {/* Champ conditionnel */}
                    {!isNouveauNom ? (
                      <div className="space-y-2">
                        <select
                          className="w-full border-2 text-gray-500 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white"
                          value={nomSelectionne}
                          onChange={(e) => setNomSelectionne(e.target.value)}
                        >
                          <option value="">Sélectionnez un client habituel</option>
                          {loadingNoms ? (
                            <option disabled>Chargement...</option>
                          ) : (
                            nomsFrequents.map((client, index) => (
                              <option key={index} value={client.nom}>
                                {client.nom} ({client.count} séance{client.count > 1 ? 's' : ''})
                              </option>
                            ))
                          )}
                        </select>
                        {nomsFrequents.length === 0 && !loadingNoms && (
                          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                            Aucun client habituel trouvé. Commencez par ajouter un nouveau client.
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ex: Ndeye seck"
                        className="w-full border-2 text-gray-500 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all bg-gray-50 focus:bg-white"
                        value={nouveauNom}
                        onChange={(e) => setNouveauNom(e.target.value)}
                      />
                    )}
                  </div>
                )}

                {type === "abonnement" && (
                  <div className="space-y-2">
                    <label className="text-gray-700 font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      Durée de l&apos;abonnement
                    </label>
                    <select
                      className="w-full border-2 text-gray-500 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all bg-gray-50 focus:bg-white"
                      value={duree}
                      onChange={(e) => setDuree(e.target.value)}
                    >
                      <option value="1mois">1 mois - Flexibilité maximale</option>
                      <option value="1an">1 an - Meilleur rapport qualité/prix</option>
                    </select>
                  </div>
                )}

                {/* Sélection du montant avec options prédéfinies */}
                <div className="space-y-2">
                  <label className="text-gray-700 font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    Montant payé (FCFA) *
                  </label>
                  
                  {/* Menu déroulant pour les montants prédéfinis */}
                  <select
                    className="w-full border-2 text-gray-500 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all bg-gray-50 focus:bg-white"
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

                  {/* Champ personnalisé si "custom" est sélectionné */}
                  {isCustomMontant && (
                    <div className="relative mt-3">
                      <input
                        type="number"
                        placeholder="Entrez le montant personnalisé"
                        className="w-full text-gray-500 border-2 border-gray-200 p-4 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all bg-gray-50 focus:bg-white pr-16"
                        value={montantCustom}
                        onChange={(e) => setMontantCustom(e.target.value)}
                        required
                        min="1"
                      />
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">
                        FCFA
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Information sur la mise à jour des rapports et présence */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3 text-blue-800">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">Automatisation complète</div>
                    <div className="text-sm text-blue-600">
                      Ce paiement sera automatiquement ajouté aux rapports et la présence sera marquée automatiquement
                    </div>
                  </div>
                </div>
              </div>

              {/* Bouton de soumission avec loading */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enregistrement complet...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Enregistrer Paiement + Présence
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Animation CSS pour le message */}
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