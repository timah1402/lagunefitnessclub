"use client";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { doc, getDocs, collection, getDoc, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  Bell,
  Activity,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [revenusJour, setRevenusJour] = useState(0);
  const [revenusMois, setRevenusMois] = useState(0);
  const [revenusAnnee, setRevenusAnnee] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [dataGraph, setDataGraph] = useState([]);
  const [loading, setLoading] = useState(true);

  // Déplacé avant les autres useEffect
  useEffect(() => {
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  // Tous les useEffect doivent être appelés de manière inconditionnelle
  useEffect(() => {
  const fetchNotifications = async () => {
    const snap = await getDocs(collection(db, "abonnements"));
    const today = new Date();
    const expiringSoon = [];
    const expired = [];

    snap.forEach((doc) => {
      const data = doc.data();
      
      // Vérifier si les dates existent
      if (!data.date_fin) {
        return; // Ignorer les abonnements sans date de fin
      }

      const dateFin = new Date(data.date_fin);
      const diffDays = Math.ceil((dateFin - today) / (1000 * 60 * 60 * 24));

      // Abonnements expirés (date de fin < aujourd'hui)
      if (diffDays < 0) {
        expired.push({
          message: `L'abonnement de ${data.nom_client} a expiré il y a ${Math.abs(diffDays)} jour(s).`,
          type: 'expired',
          days: diffDays,
          client: data.nom_client
        });
      }
      // Abonnements qui vont expirer dans les 7 prochains jours
      else if (diffDays <= 7 && diffDays >= 0) {
        expiringSoon.push({
          message: `L'abonnement de ${data.nom_client} expire dans ${diffDays} jour(s).`,
          type: diffDays <= 3 ? 'urgent' : 'warning',
          days: diffDays,
          client: data.nom_client
        });
      }
    });

    // Combiner les notifications expirées et celles qui vont expirer
    const allNotifications = [...expired, ...expiringSoon];

    // Trier par priorité : expirés d'abord, puis par nombre de jours
    allNotifications.sort((a, b) => {
      if (a.type === 'expired' && b.type !== 'expired') return -1;
      if (a.type !== 'expired' && b.type === 'expired') return 1;
      return a.days - b.days;
    });

    if (allNotifications.length === 0) {
      allNotifications.push({
        message: "Aucun abonnement n'expire dans les 7 prochains jours.",
        type: 'success',
        days: null
      });
    }

    setNotifications(allNotifications);
  };

  fetchNotifications();
}, []);


  useEffect(() => {
    const fetchDashboardRevenus = async () => {
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

      setRevenusJour(totalJour);
      setRevenusMois(totalMois);
      setRevenusAnnee(totalAnnee);
    };

    fetchDashboardRevenus();
  }, []);

  useEffect(() => {
    const fetchFrequentation = async () => {
      const days = 7;
      const data = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split("T")[0];

        const start = `${dayStr}T00:00:00Z`;
        const end = `${dayStr}T23:59:59Z`;

        const presencesQuery = query(
          collection(db, "presences"),
          where("date", ">=", start),
          where("date", "<=", end)
        );
        const snapshot = await getDocs(presencesQuery);

        data.push({
          jour: `${date.getDate()}/${date.getMonth() + 1}`,
          fréquentation: snapshot.size,
        });
      }

      setDataGraph(data);
      setLoading(false);
    };

    fetchFrequentation();
  }, []);

  // Affichage conditionnel après tous les hooks
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification de la connexion...</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-all duration-300 border-l-4" 
         style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+{trend}% ce mois</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-8 h-8" style={{ color }} />
        </div>
      </div>
    </div>
  );

  const NotificationItem = ({ notification }) => {
   const getNotificationStyle = (type) => {
  switch (type) {
    case 'expired':
      return {
        bg: 'bg-red-100 border-red-300',
        icon: AlertTriangle,
        iconColor: 'text-red-600',
        textColor: 'text-red-900'
      };
    case 'urgent':
      return {
        bg: 'bg-red-50 border-red-200',
        icon: AlertTriangle,
        iconColor: 'text-red-500',
        textColor: 'text-red-800'
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50 border-yellow-200',
        icon: Bell,
        iconColor: 'text-yellow-500',
        textColor: 'text-yellow-800'
      };
    default:
      return {
        bg: 'bg-green-50 border-green-200',
        icon: CheckCircle,
        iconColor: 'text-green-500',
        textColor: 'text-green-800'
      };
  }
};

    const style = getNotificationStyle(notification.type);
    const IconComponent = style.icon;

    
    return (
      <div className={`p-4 rounded-lg border ${style.bg} ${style.textColor} transition-all duration-200 hover:shadow-md`}>
        <div className="flex items-start space-x-3">
          <IconComponent className={`w-5 h-5 mt-0.5 ${style.iconColor}`} />
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <main className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Dashboard Gym Admin
              </h1>
              <p className="text-gray-600 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Bienvenue, {user.email} !
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                {/* <p className="text-sm text-gray-500">Aujourd&apos;hui</p> */}
                <p className="text-lg font-semibold text-gray-900">
                  {new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Revenus Aujourd'hui"
            value={`${revenusJour.toLocaleString()} FCFA`}
            icon={DollarSign}
            color="#10b981"
            trend="12"
          />
          <StatCard
            title="Revenus Mensuels"
            value={`${revenusMois.toLocaleString()} FCFA`}
            icon={TrendingUp}
            color="#3b82f6"
            trend="8"
          />
          <StatCard
            title="Revenus Annuels"
            value={`${revenusAnnee.toLocaleString()} FCFA`}
            icon={Activity}
            color="#8b5cf6"
            trend="15"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  Fréquentation sur les 7 derniers jours
                </h2>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Visiteurs</span>
                </div>
              </div>
              
              {dataGraph.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dataGraph} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="jour" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis 
                        allowDecimals={false} 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                      />
                      <Bar 
                        dataKey="fréquentation" 
                        fill="url(#colorBar)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center">
                  <p className="text-gray-500">Aucune donnée disponible</p>
                </div>
              )}
            </div>
          </div>

          {/* Notifications Section */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <Bell className="w-5 h-5 mr-2 text-orange-500" />
                Notifications
                {notifications.some(n => n.type === 'urgent' || n.type === 'warning') && (
                  <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {notifications.map((notification, index) => (
                  <NotificationItem key={index} notification={notification} />
                ))}
              </div>
            </div>
          </div>
        </div>

       
      </main>
    </div>
  );
}