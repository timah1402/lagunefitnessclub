"use client";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { 
  FileText, 
  TrendingUp, 
  Calendar, 
  Users, 
  DollarSign, 
  RotateCcw, 
  Activity,
  Clock,
  BarChart3,
  Download,
  RefreshCw
} from "lucide-react";

export default function RapportsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [resetMessage, setResetMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [revenus, setRevenus] = useState({ jour: 0, mois: 0, annee: 0 });
  const [frequentation, setFrequentation] = useState([]);

  if (!user) {
    router.push("/login");
    return null;
  }

  const handleResetDailyCycle = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const jour = today.getDate();
      const mois = today.getMonth() + 1;
      const annee = today.getFullYear();

      const rapportId = `${jour}-${mois}-${annee}`;
      const rapportRef = doc(db, "rapports", rapportId);
      const rapportSnap = await getDoc(rapportRef);

      if (!rapportSnap.exists()) {
        setResetMessage("❌ Aucun rapport trouvé pour aujourd'hui.");
        setTimeout(() => setResetMessage(""), 5000);
        return;
      }

      const rapportData = rapportSnap.data();

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const jourTomorrow = tomorrow.getDate();
      const moisTomorrow = tomorrow.getMonth() + 1;
      const anneeTomorrow = tomorrow.getFullYear();
      const rapportTomorrowRef = doc(db, "rapports", `${jourTomorrow}-${moisTomorrow}-${anneeTomorrow}`);

      // Créer le rapport du lendemain
      await setDoc(rapportTomorrowRef, {
        jour: jourTomorrow,
        mois: moisTomorrow,
        annee: anneeTomorrow,
        total_journalier: 0,
        total_mensuel: rapportData.total_mensuel,
        total_annuel: rapportData.total_annuel,
        createdAt: new Date(),
      });

      // Remettre le total journalier du jour à 0
      await setDoc(rapportRef, {
        ...rapportData,
        total_journalier: 0,
        updatedAt: new Date(),
      });

      setResetMessage(`✅ Cycle journalier réinitialisé pour ${jourTomorrow}/${moisTomorrow}/${anneeTomorrow}`);
      setTimeout(() => setResetMessage(""), 5000);
      
      // Actualiser les données
      fetchRevenus();
    } catch (error) {
      console.error("Erreur lors de la réinitialisation:", error);
      setResetMessage("❌ Erreur lors de la réinitialisation du cycle.");
      setTimeout(() => setResetMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Charger les rapports financiers
  const fetchRevenus = async () => {
    try {
      const today = new Date();
      const jour = today.getDate();
      const mois = today.getMonth() + 1;
      const annee = today.getFullYear();
      const rapportId = `${jour}-${mois}-${annee}`;

      const rapportRef = doc(db, "rapports", rapportId);
      const rapportSnap = await getDoc(rapportRef);

      let totalJour = 0;
      let totalMois = 0;
      let totalAnnee = 0;

      if (rapportSnap.exists()) {
        const data = rapportSnap.data();
        totalJour = data.total_journalier || 0;
        totalMois = data.total_mensuel || 0;
        totalAnnee = data.total_annuel || 0;
      }

      setRevenus({
        jour: totalJour,
        mois: totalMois,
        annee: totalAnnee,
      });
    } catch (error) {
      console.error("Erreur lors du chargement des revenus:", error);
    }
  };

  useEffect(() => {
    fetchRevenus();
  }, []);

  // Charger la fréquentation quotidienne
  useEffect(() => {
    const fetchFrequentation = async () => {
      try {
        const days = 7;
        const data = [];

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStr = date.toISOString().split("T")[0]; // "YYYY-MM-DD"

          const dayStart = `${dayStr}T00:00:00Z`;
          const dayEnd = `${dayStr}T23:59:59Z`;

          const presencesQuery = query(
            collection(db, "presences"),
            where("date", ">=", dayStart),
            where("date", "<=", dayEnd)
          );
          const snapshot = await getDocs(presencesQuery);

          data.push({
            date: `${date.getDate()}/${date.getMonth() + 1}`,
            nombre: snapshot.size,
          });
        }

        setFrequentation(data);
      } catch (error) {
        console.error("Erreur lors du chargement de la fréquentation:", error);
      }
    };

    fetchFrequentation();
  }, []);

  // Calculer les statistiques pour les graphiques
  const frequentationStats = frequentation.reduce((acc, day) => acc + day.nombre, 0);
  const moyenneFrequentation = frequentationStats / frequentation.length || 0;

  const revenuData = [
    { name: "Aujourd'hui", value: revenus.jour, color: "#3b82f6" },
    { name: "Ce mois", value: revenus.mois - revenus.jour, color: "#10b981" },
    { name: "Cette année", value: revenus.annee - revenus.mois, color: "#8b5cf6" }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-600 rounded-lg">
              <FileText className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Rapports Financiers & Fréquentation
            </h1>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Visiteurs (7j)</p>
                  <p className="text-2xl font-bold text-blue-700">{frequentationStats}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Moyenne/jour</p>
                  <p className="text-2xl font-bold text-green-700">{Math.round(moyenneFrequentation)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Gain/visiteur</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {frequentationStats > 0 ? Math.round(revenus.mois / frequentationStats) : 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-sm font-medium">Croissance</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {revenus.mois > 0 ? Math.round((revenus.jour / revenus.mois) * 100) : 0}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Message de notification */}
        {resetMessage && (
          <div className={`rounded-xl p-4 border-l-4 ${
            resetMessage.startsWith("✅") 
              ? "bg-green-50 border-green-400 text-green-700" 
              : "bg-red-50 border-red-400 text-red-700"
          }`}>
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium">{resetMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions rapides */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rapports détaillés */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Download className="h-5 w-5 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-800">Rapports Détaillés</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="/rapports/journalier"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <Calendar className="h-5 w-5" />
                Rapport Journalier
              </a>
              <a
                href="/rapports/mensuel"
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <Clock className="h-5 w-5" />
                Rapport Mensuel
              </a>
            </div>
          </div>

          {/* Cycle journalier */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw className="h-5 w-5 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-800">Gestion du Cycle</h2>
            </div>
            <button
              onClick={handleResetDailyCycle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <RotateCcw className="h-5 w-5" />
              )}
              Réinitialiser le cycle journalier
            </button>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Prépare le rapport pour le jour suivant
            </p>
          </div>
        </div>

        {/* Revenus */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-blue-900">Aujourd'hui</h3>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-700 mb-2">
              {revenus.jour.toLocaleString()} FCFA
            </p>
            <p className="text-sm text-blue-600">
              Gains de la journée en cours
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-green-900">Ce Mois</h3>
              </div>
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mb-2">
              {revenus.mois.toLocaleString()} FCFA
            </p>
            <p className="text-sm text-green-600">
              Revenus mensuels cumulés
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-purple-900">Cette Année</h3>
              </div>
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-700 mb-2">
              {revenus.annee.toLocaleString()} FCFA
            </p>
            <p className="text-sm text-purple-600">
              Performance annuelle totale
            </p>
          </div>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fréquentation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-5 w-5 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-800">Fréquentation (7 derniers jours)</h2>
            </div>
            {frequentation.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={frequentation}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="nombre" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Chargement des données de fréquentation...</p>
                </div>
              </div>
            )}
          </div>

          {/* Répartition des revenus */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-800">Répartition des Revenus</h2>
            </div>
            {revenus.annee > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenuData.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {revenuData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value.toLocaleString()} FCFA`, '']}
                    contentStyle={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Aucune donnée de revenus disponible</p>
                </div>
              </div>
            )}
            
            {/* Légende */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {revenuData.filter(item => item.value > 0).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}