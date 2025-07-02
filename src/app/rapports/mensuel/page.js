"use client";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function RapportMensuelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const rapportRef = useRef();

  const [paiements, setPaiements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchPaiementsDuMois = async () => {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDay = new Date(year, month, 1).toISOString();
        const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        const paiementsMois = [];
        let totalMois = 0;

        // Abonnements
        const abonnementsQ = query(
          collection(db, "abonnements"),
          where("date_debut", ">=", firstDay),
          where("date_debut", "<=", lastDay)
        );
        const abonnementsSnap = await getDocs(abonnementsQ);
        abonnementsSnap.forEach((doc) => {
          const data = doc.data();
          paiementsMois.push({ type: "Abonnement", ...data });
          totalMois += data.montant || 0;
        });

        // Séances
        const seancesQ = query(
          collection(db, "seances"),
          where("date", ">=", firstDay),
          where("date", "<=", lastDay)
        );
        const seancesSnap = await getDocs(seancesQ);
        seancesSnap.forEach((doc) => {
          const data = doc.data();
          paiementsMois.push({ type: "Séance", ...data });
          totalMois += data.montant || 0;
        });

        // Transactions (renouvellements)
        const transactionsQ = query(
          collection(db, "transactions"),
          where("date", ">=", firstDay),
          where("date", "<=", lastDay)
        );
        const transactionsSnap = await getDocs(transactionsQ);
        transactionsSnap.forEach((doc) => {
          const data = doc.data();
          paiementsMois.push({ type: "Renouvellement", ...data });
          totalMois += data.montant || 0;
        });

        setPaiements(paiementsMois);
        setTotal(totalMois);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        alert("Erreur lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    fetchPaiementsDuMois();
  }, [user]);

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    const monthName = new Date().toLocaleString("fr-FR", { month: "long", year: "numeric" });
    const currentTime = new Date().toLocaleTimeString('fr-FR');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Mensuel - Lagune Fitness Club - ${monthName}</title>
        <style>
          @media print {
            body { margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            @page { size: A4; margin: 1.5cm; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; line-height: 1.6; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; }
          .club-logo { font-size: 32px; font-weight: bold; color: #4f46e5; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px; }
          .club-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 20px; font-style: italic; }
          .report-title { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
          .report-info { display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #4f46e5; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
          th, td { padding: 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .type-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .type-abonnement { background-color: #dcfce7; color: #166534; }
          .type-seance { background-color: #dbeafe; color: #1e40af; }
          .type-renouvellement { background-color: #fef3c7; color: #92400e; }
          .total-section { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin-top: 30px; }
          .total-amount { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
          .no-data { text-align: center; color: #6b7280; padding: 60px 20px; background-color: #f9fafb; border-radius: 12px; border: 2px dashed #d1d5db; }
          .stats-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .stat-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }
          .stat-number { font-size: 24px; font-weight: bold; color: #4f46e5; }
          .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="club-logo">🏋️ Lagune Fitness Club</div>
          <div class="club-subtitle">Excellence • Performance • Bien-être</div>
          <div class="report-title">Rapport Mensuel</div>
        </div>

        <div class="report-info">
          <div class="date-info">📅 ${monthName}</div>
          <div class="time-info">⏰ Généré le ${new Date().toLocaleDateString('fr-FR')} à ${currentTime}</div>
        </div>

        <div class="stats-summary">
          <div class="stat-card">
            <div class="stat-number">${paiements.length}</div>
            <div class="stat-label">Transactions</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${paiements.filter(p => p.type === 'Abonnement').length}</div>
            <div class="stat-label">Abonnements</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${paiements.filter(p => p.type === 'Séance').length}</div>
            <div class="stat-label">Séances</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${paiements.filter(p => p.type === 'Renouvellement').length}</div>
            <div class="stat-label">Renouvellements</div>
          </div>
        </div>
        
        ${paiements.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Client</th>
                <th style="text-align: right;">Montant</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${paiements.map(p => `
                <tr>
                  <td><span class="type-badge type-${p.type.toLowerCase()}">${p.type}</span></td>
                  <td>${p.nom_client || "Anonyme"}</td>
                  <td style="text-align: right; font-weight: 600;">${(p.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                  <td>${p.date ? new Date(p.date).toLocaleDateString('fr-FR') : p.date_debut ? new Date(p.date_debut).toLocaleDateString('fr-FR') : "-"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="no-data">
            <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">📊</div>
            <h3>Aucune transaction ce mois</h3>
            <p>Aucun paiement n'a été enregistré pour ce mois.</p>
          </div>
        `}
        
        <div class="total-section">
          <div class="total-amount">${total.toLocaleString('fr-FR')} FCFA</div>
          <div style="font-size: 16px; opacity: 0.9;">💰 Total des recettes du mois</div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadCSV = () => {
    const monthName = new Date().toLocaleString("fr-FR", { month: "long", year: "numeric" });
    const csvContent = [
      ['Lagune Fitness Club - Rapport Mensuel'],
      [`Mois: ${monthName}`],
      [''],
      ['Type', 'Client', 'Montant (FCFA)', 'Date'],
      ...paiements.map(p => [
        p.type, 
        p.nom_client || 'Anonyme', 
        p.montant || 0,
        p.date ? new Date(p.date).toLocaleDateString('fr-FR') : p.date_debut ? new Date(p.date_debut).toLocaleDateString('fr-FR') : "-"
      ]),
      [''],
      ['Total du mois', '', total, '']
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `lagune-fitness-rapport-mensuel-${monthName.replace(/ /g, '-')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthName = new Date().toLocaleString("fr-FR", { month: "long", year: "numeric" });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirection vers la connexion...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header avec logo */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center text-purple-600 hover:text-purple-800 font-semibold transition-colors duration-200 hover:bg-purple-50 px-4 py-2 rounded-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🏋️ Lagune Fitness Club
              </h1>
              <p className="text-gray-600 text-sm">Excellence • Performance • Bien-être</p>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-gray-500">{monthName}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
              📊 Rapport Mensuel
            </h2>
            <p className="text-center text-gray-600">
              Résumé des transactions du mois
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Chargement du rapport...</p>
          </div>
        ) : (
          <>
            {/* Statistiques rapides */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 text-center border-l-4 border-purple-500">
                <div className="text-3xl font-bold text-purple-600 mb-2">{paiements.length}</div>
                <div className="text-gray-600 font-medium">Transactions</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 text-center border-l-4 border-green-500">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {paiements.filter(p => p.type === 'Abonnement').length}
                </div>
                <div className="text-gray-600 font-medium">Abonnements</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 text-center border-l-4 border-blue-500">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {paiements.filter(p => p.type === 'Séance').length}
                </div>
                <div className="text-gray-600 font-medium">Séances</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 text-center border-l-4 border-yellow-500">
                <div className="text-3xl font-bold text-yellow-600 mb-2">
                  {paiements.filter(p => p.type === 'Renouvellement').length}
                </div>
                <div className="text-gray-600 font-medium">Renouvellements</div>
              </div>
            </div>

            {/* Contenu du rapport */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div ref={rapportRef} className="p-8">
                {/* En-tête pour le PDF */}
                <div className="text-center mb-8 pb-6 border-b-2 border-purple-500">
                  <h1 className="text-4xl font-bold text-purple-600 mb-2">
                    🏋️ Lagune Fitness Club
                  </h1>
                  <p className="text-gray-600 mb-4">Excellence • Performance • Bien-être</p>
                  <h2 className="text-2xl font-bold text-gray-800">Rapport Mensuel</h2>
                  <p className="text-gray-600 mt-2">{monthName}</p>
                </div>

                {paiements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                          <th className="p-4 text-left font-semibold">Type</th>
                          <th className="p-4 text-left font-semibold">Client</th>
                          <th className="p-4 text-right font-semibold">Montant (FCFA)</th>
                          <th className="p-4 text-left font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paiements.map((p, idx) => (
                          <tr key={idx} className={`${idx % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-purple-50 transition-colors duration-150`}>
                            <td className="p-4 border-b border-gray-200">
                              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                p.type === 'Abonnement' ? 'bg-green-100 text-green-800' :
                                p.type === 'Séance' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="p-4 border-b border-gray-200 font-medium">
                              {p.nom_client || "Anonyme"}
                            </td>
                            <td className="p-4 border-b border-gray-200 text-right font-bold text-gray-800">
                              {(p.montant || 0).toLocaleString('fr-FR')}
                            </td>
                            <td className="p-4 border-b border-gray-200">
                              {p.date
                                ? new Date(p.date).toLocaleDateString('fr-FR')
                                : p.date_debut
                                ? new Date(p.date_debut).toLocaleDateString('fr-FR')
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-6 opacity-50">📊</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      Aucune transaction ce mois
                    </h3>
                    <p className="text-gray-500">
                      Aucun paiement n'a été enregistré pour ce mois.
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="mt-8 bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold mb-2">
                    {total.toLocaleString('fr-FR')} FCFA
                  </div>
                  <div className="text-lg opacity-90">
                    💰 Total des recettes du mois
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handlePrintPDF}
                    disabled={loading}
                    className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimer / PDF
                  </button>

                  {/* <button
                    onClick={handleDownloadCSV}
                    disabled={loading}
                    className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exporter CSV
                  </button> */}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}