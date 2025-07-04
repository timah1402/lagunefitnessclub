"use client";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function RapportJournalierPage() {
  const { user } = useAuth();
  const router = useRouter();
  const rapportRef = useRef();

  const [paiements, setPaiements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Redirection si pas d'utilisateur
  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;

   // Remplacez la fonction fetchPaiementsDuJour dans votre rapport journalier par celle-ci :

const fetchPaiementsDuJour = async () => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    // Utiliser la même approche que le rapport mensuel pour la cohérence
    const startOfDay = new Date(year, month, day, 0, 0, 0).toISOString();
    const endOfDay = new Date(year, month, day, 23, 59, 59).toISOString();

    const paiementsJour = [];
    let totalJour = 0;

    // Abonnements créés aujourd'hui
    const abonnementsQ = query(
      collection(db, "abonnements"),
      where("date_debut", ">=", startOfDay),
      where("date_debut", "<=", endOfDay)
    );
    const abonnementsSnap = await getDocs(abonnementsQ);
    abonnementsSnap.forEach((doc) => {
      const data = doc.data();
      paiementsJour.push({ type: "Abonnement", ...data });
      totalJour += data.montant || 0;
    });

    // Séances du jour
    const seancesQ = query(
      collection(db, "seances"),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay)
    );
    const seancesSnap = await getDocs(seancesQ);
    seancesSnap.forEach((doc) => {
      const data = doc.data();
      paiementsJour.push({ type: "Séance", ...data });
      totalJour += data.montant || 0;
    });

    // Transactions (renouvellements) du jour
    const transactionsQ = query(
      collection(db, "transactions"),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay)
    );
    const transactionsSnap = await getDocs(transactionsQ);
    transactionsSnap.forEach((doc) => {
      const data = doc.data();
      paiementsJour.push({ type: "Renouvellement", ...data });
      totalJour += data.montant || 0;
    });

    // Trier par date pour avoir un ordre chronologique
    paiementsJour.sort((a, b) => {
      const dateA = new Date(a.date || a.date_debut);
      const dateB = new Date(b.date || b.date_debut);
      return dateA - dateB;
    });

    setPaiements(paiementsJour);
    setTotal(totalJour);
    
    // Debug: afficher les résultats dans la console
    console.log("Période recherchée:", { startOfDay, endOfDay });
    console.log("Paiements trouvés:", paiementsJour);
    console.log("Total:", totalJour);
    
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    alert("Erreur lors du chargement des données");
  } finally {
    setLoading(false);
  }
};
    fetchPaiementsDuJour();
  }, [user]);

  // Fonction d'impression améliorée avec le logo du club
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const currentTime = new Date().toLocaleTimeString('fr-FR');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Journalier - Lagune Fitness Club - ${currentDate}</title>
        <style>
          @media print {
            body { margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            @page { size: A4; margin: 1.5cm; }
            .no-print { display: none !important; }
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px; 
            line-height: 1.6;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
          }
          .club-logo {
            font-size: 32px;
            font-weight: bold;
            color: #4f46e5;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .club-subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 20px;
            font-style: italic;
          }
          .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .report-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #4f46e5;
          }
          .date-info {
            font-weight: bold;
            color: #374151;
          }
          .time-info {
            font-size: 14px;
            color: #6b7280;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          th, td { 
            padding: 15px; 
            text-align: left; 
            border-bottom: 1px solid #e5e7eb;
          }
          th { 
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          tr:hover {
            background-color: #f3f4f6;
          }
          .type-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .type-abonnement {
            background-color: #dcfce7;
            color: #166534;
          }
          .type-seance {
            background-color: #dbeafe;
            color: #1e40af;
          }
          .type-renouvellement {
            background-color: #fef3c7;
            color: #92400e;
          }
          .total-section {
            background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            margin-top: 30px;
          }
          .total-amount {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .total-label {
            font-size: 16px;
            opacity: 0.9;
          }
          .no-data {
            text-align: center;
            color: #6b7280;
            padding: 60px 20px;
            background-color: #f9fafb;
            border-radius: 12px;
            border: 2px dashed #d1d5db;
          }
          .no-data-icon {
            font-size: 48px;
            margin-bottom: 15px;
            opacity: 0.5;
          }
          .stats-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            text-align: center;
          }
          .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #4f46e5;
          }
          .stat-label {
            font-size: 14px;
            color: #6b7280;
            margin-top: 5px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="club-logo">🏋️ Lagune Fitness Club</div>
          <div class="club-subtitle">Excellence • Performance • Bien-être</div>
          <div class="report-title">Rapport Journalier</div>
        </div>

        <div class="report-info">
          <div class="date-info">📅 ${currentDate}</div>
          <div class="time-info">⏰ Généré le ${currentDate} à ${currentTime}</div>
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
              </tr>
            </thead>
            <tbody>
              ${paiements.map(p => `
                <tr>
                  <td>
                    <span class="type-badge type-${p.type.toLowerCase()}">
                      ${p.type}
                    </span>
                  </td>
                  <td>${p.nom_client || "Anonyme"}</td>
                  <td style="text-align: right; font-weight: 600;">
                    ${(p.montant || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="no-data">
            <div class="no-data-icon">📊</div>
            <h3>Aucune transaction</h3>
            <p>Aucun paiement n'a été enregistré pour aujourd'hui.</p>
          </div>
        `}
        
        <div class="total-section">
          <div class="total-amount">${total.toLocaleString('fr-FR')} FCFA</div>
          <div class="total-label">Total des recettes du jour</div>
        </div>

        <div class="footer">
          <p>Lagune Fitness Club - Rapport généré automatiquement</p>
          <p>Pour toute question, contactez l'administration</p>
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

  // Fonction de téléchargement PDF améliorée
  const handleDownloadPDF = async () => {
    if (!rapportRef.current) {
      alert("Le rapport n'est pas prêt pour l'impression.");
      return;
    }

    if (pdfLoading) return;

    setPdfLoading(true);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const options = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `lagune-fitness-rapport-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'in', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf()
        .set(options)
        .from(rapportRef.current)
        .save();

    } catch (error) {
      console.error("Erreur détaillée:", error);
      alert(`Erreur lors de la génération du PDF: ${error.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // Fonction CSV améliorée
  const handleDownloadCSV = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const csvContent = [
      ['Lagune Fitness Club - Rapport Journalier'],
      [`Date: ${currentDate}`],
      [''],
      ['Type', 'Client', 'Montant (FCFA)'],
      ...paiements.map(p => [p.type, p.nom_client || 'Anonyme', p.montant || 0]),
      [''],
      ['Total du jour', '', total]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `lagune-fitness-rapport-${currentDate.replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
              📊 Rapport Journalier
            </h2>
            <p className="text-center text-gray-600">
              Résumé des transactions du jour
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
                  <h2 className="text-2xl font-bold text-gray-800">Rapport Journalier</h2>
                  <p className="text-gray-600 mt-2">
                    {new Date().toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>

                {paiements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                          <th className="p-4 text-left font-semibold">Type</th>
                          <th className="p-4 text-left font-semibold">Client</th>
                          <th className="p-4 text-right font-semibold">Montant (FCFA)</th>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-6 opacity-50">📊</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      Aucune transaction aujourd&apos;hui
                    </h3>
                    <p className="text-gray-500">
                      Aucun paiement n&apos;a été enregistré pour cette journée.
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="mt-8 bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold mb-2">
                    {total.toLocaleString('fr-FR')} FCFA
                  </div>
                  <div className="text-lg opacity-90">
                    💰 Total des recettes du jour
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    onClick={handleDownloadPDF}
                    disabled={loading || pdfLoading}
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pdfLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    ) : (
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    {pdfLoading ? 'Génération...' : 'Télécharger PDF'}
                  </button> */}

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