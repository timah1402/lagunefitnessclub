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

  // Fonction d'impression ultra-compacte
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const currentTime = new Date().toLocaleTimeString('fr-FR');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Journalier - ${currentDate}</title>
        <style>
          @media print {
            body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; }
            @page { size: A4; margin: 1cm; }
            .no-print { display: none !important; }
          }
          body { 
            font-family: Arial, sans-serif; 
            padding: 10px; 
            line-height: 1.3;
            color: #333;
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 10px;
          }
          .club-logo {
            font-size: 18px;
            font-weight: bold;
            color: #4f46e5;
            margin-bottom: 3px;
          }
          .report-title {
            font-size: 16px;
            font-weight: bold;
            margin: 5px 0;
          }
          .report-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8fafc;
            padding: 8px;
            margin-bottom: 15px;
            font-size: 11px;
          }
          .stats-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 15px;
          }
          .stat-card {
            background: #f9fafb;
            padding: 8px;
            text-align: center;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
          }
          .stat-number {
            font-size: 16px;
            font-weight: bold;
            color: #4f46e5;
          }
          .stat-label {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px;
            font-size: 11px;
          }
          th, td { 
            padding: 6px 8px; 
            text-align: left; 
            border: 1px solid #d1d5db;
          }
          th { 
            background: #4f46e5;
            color: white;
            font-weight: 600;
            font-size: 10px;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .type-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
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
            background: #374151;
            color: white;
            padding: 12px;
            text-align: center;
            margin-top: 15px;
          }
          .total-amount {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 3px;
          }
          .total-label {
            font-size: 12px;
          }
          .no-data {
            text-align: center;
            color: #6b7280;
            padding: 30px 20px;
            background-color: #f9fafb;
            border: 1px dashed #d1d5db;
          }
          .footer {
            margin-top: 15px;
            text-align: center;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="club-logo">🏋️ Lagune Fitness Club</div>
          <div class="report-title">Rapport Journalier - ${currentDate}</div>
        </div>

        <div class="report-info">
          <div>📅 ${currentDate}</div>
          <div>⏰ ${currentTime}</div>
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
                <th style="width: 20%;">Type</th>
                <th style="width: 50%;">Client</th>
                <th style="width: 30%; text-align: right;">Montant (FCFA)</th>
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
                    ${(p.montant || 0).toLocaleString('fr-FR')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="no-data">
            <div style="font-size: 24px; margin-bottom: 10px;">📊</div>
            <div><strong>Aucune transaction aujourd'hui</strong></div>
          </div>
        `}
        
        <div class="total-section">
          <div class="total-amount">${total.toLocaleString('fr-FR')} FCFA</div>
          <div class="total-label">💰 Total des recettes du jour</div>
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
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `lagune-fitness-rapport-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 1.5,
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
              <div ref={rapportRef} className="p-6">
                {/* En-tête compact pour le PDF */}
                <div className="text-center mb-6 pb-4 border-b-2 border-purple-500">
                  <h1 className="text-2xl font-bold text-purple-600 mb-1">
                    🏋️ Lagune Fitness Club
                  </h1>
                  <h2 className="text-xl font-bold text-gray-800 mb-1">Rapport Journalier</h2>
                  <p className="text-gray-600 text-sm">
                    {new Date().toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>

                {/* Statistiques compactes */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-3 text-center rounded">
                    <div className="text-lg font-bold text-purple-600">{paiements.length}</div>
                    <div className="text-xs text-gray-600">Transactions</div>
                  </div>
                  <div className="bg-gray-50 p-3 text-center rounded">
                    <div className="text-lg font-bold text-green-600">
                      {paiements.filter(p => p.type === 'Abonnement').length}
                    </div>
                    <div className="text-xs text-gray-600">Abonnements</div>
                  </div>
                  <div className="bg-gray-50 p-3 text-center rounded">
                    <div className="text-lg font-bold text-blue-600">
                      {paiements.filter(p => p.type === 'Séance').length}
                    </div>
                    <div className="text-xs text-gray-600">Séances</div>
                  </div>
                  <div className="bg-gray-50 p-3 text-center rounded">
                    <div className="text-lg font-bold text-yellow-600">
                      {paiements.filter(p => p.type === 'Renouvellement').length}
                    </div>
                    <div className="text-xs text-gray-600">Renouvellements</div>
                  </div>
                </div>

                {paiements.length > 0 ? (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                          <th className="p-2 text-left font-semibold text-xs">Type</th>
                          <th className="p-2 text-left font-semibold text-xs">Client</th>
                          <th className="p-2 text-right font-semibold text-xs">Montant (FCFA)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paiements.map((p, idx) => (
                          <tr key={idx} className={`${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                            <td className="p-2 border-b border-gray-200">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                                p.type === 'Abonnement' ? 'bg-green-100 text-green-800' :
                                p.type === 'Séance' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="p-2 border-b border-gray-200 font-medium text-black">
                              {p.nom_client || "Anonyme"}
                            </td>
                            <td className="p-2 border-b border-gray-200 text-right font-bold text-gray-800">
                              {(p.montant || 0).toLocaleString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4 opacity-50">📊</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Aucune transaction aujourd&apos;hui
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Aucun paiement n&apos;a été enregistré pour cette journée.
                    </p>
                  </div>
                )}

                {/* Total compact */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 rounded text-center">
                  <div className="text-2xl font-bold mb-1">
                    {total.toLocaleString('fr-FR')} FCFA
                  </div>
                  <div className="text-sm opacity-90">
                    💰 Total des recettes du jour
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
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

                 

                 
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}