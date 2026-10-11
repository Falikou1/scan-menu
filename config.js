/**
 * Menu Scan — Configuration API
 * 
 * Ce fichier configure l'URL de base de l'API backend.
 * 
 * DÉVELOPPEMENT LOCAL (XAMPP) :
 *   window.API_BASE = '';  // Utilise l'URL relative
 * 
 * PRODUCTION (Vercel + Railway) :
 *   window.API_BASE = 'https://votre-backend.railway.app/';
 * 
 * Pour modifier l'URL de l'API en production, éditez la ligne ci-dessous.
 */

(function() {
  // Détecter automatiquement l'environnement
  var hostname = window.location.hostname;
  
  // Environnement local : utiliser URL relative
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    window.API_BASE = '';
    return;
  }
  
  // Production : utiliser l'URL Railway configurée
  // IMPORTANT : Remplacez cette URL par votre URL Railway après déploiement
  var RAILWAY_BACKEND_URL = 'RAILWAY_URL_PLACEHOLDER';
  
  if (RAILWAY_BACKEND_URL && RAILWAY_BACKEND_URL !== 'RAILWAY_URL_PLACEHOLDER') {
    window.API_BASE = RAILWAY_BACKEND_URL.replace(/\/$/, '') + '/';
  } else {
    // Fallback : même domaine (fonctionne sur Render si tout est ensemble)
    window.API_BASE = '';
  }
  
  console.log('[MenuScan] API Base URL:', window.API_BASE || '(relative)');
})();
