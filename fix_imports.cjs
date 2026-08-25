const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// src/App.tsx
replaceInFile('src/App.tsx', [
  ["'./pages/PublicRoute.tsx'", "'./pages/public/PublicRoute.tsx'"],
  ["'./pages/AdminRoute.tsx'", "'./pages/admin/AdminRoute.tsx'"],
  ["'./pages/MidiasPage.tsx'", "'./pages/public/MidiasPage.tsx'"],
]);

// src/pages/public/PublicRoute.tsx
replaceInFile('src/pages/public/PublicRoute.tsx', [
  ["'../components/TeleiosLandingPage.tsx'", "'./LandingPage.tsx'"],
  ["'../components/AuthModal.tsx'", "'../../components/common/AuthModal.tsx'"],
  ["'../types/index.ts'", "'../../types/index.ts'"],
  ["'../data/mockStore.ts'", "'../../data/mockStore.ts'"],
  ["TeleiosLandingPage", "LandingPage"]
]);

// src/pages/public/MidiasPage.tsx
replaceInFile('src/pages/public/MidiasPage.tsx', [
  ["'../types/index.ts'", "'../../types/index.ts'"]
]);

// src/pages/public/LandingPage.tsx
replaceInFile('src/pages/public/LandingPage.tsx', [
  ["'./TeleiosLogo.tsx'", "'../../components/common/TeleiosLogo.tsx'"],
  ["'./landing/", "'../../components/landing/"]
]);

// src/pages/admin/AdminRoute.tsx
replaceInFile('src/pages/admin/AdminRoute.tsx', [
  ["'../components/Sidebar.tsx'", "'../../components/admin/layout/Sidebar.tsx'"],
  ["'../components/IngestStudio.tsx'", "'../../components/admin/views/IngestStudio.tsx'"],
  ["'../components/EstudosView.tsx'", "'../../components/admin/views/EstudosView.tsx'"],
  ["'../components/GaleriaView.tsx'", "'../../components/admin/views/GaleriaView.tsx'"],
  ["'../components/VideosView.tsx'", "'../../components/admin/views/VideosView.tsx'"],
  ["'../components/ProjetosView.tsx'", "'../../components/admin/views/ProjetosView.tsx'"],
  ["'../components/QueueSchedulerMonitor.tsx'", "'../../components/admin/views/QueueSchedulerMonitor.tsx'"],
  ["'../components/ConfiguracoesView.tsx'", "'../../components/admin/views/ConfiguracoesView.tsx'"],
  ["'../components/AuthModal.tsx'", "'../../components/common/AuthModal.tsx'"],
  ["'../types/index.ts'", "'../../types/index.ts'"],
  ["'../services/security.service.ts'", "'../../services/security.service.ts'"]
]);

// src/components/admin/layout/Sidebar.tsx
replaceInFile('src/components/admin/layout/Sidebar.tsx', [
  ["'./TeleiosLogo.tsx'", "'../../common/TeleiosLogo.tsx'"],
  ["'../types/index.ts'", "'../../../types/index.ts'"],
  ["'../services/security.service.ts'", "'../../../services/security.service.ts'"]
]);

// src/components/common/AuthModal.tsx
replaceInFile('src/components/common/AuthModal.tsx', [
  ["'./TeleiosLogo.tsx'", "'./TeleiosLogo.tsx'"],
  ["'../services/security.service.ts'", "'../../services/security.service.ts'"],
  ["'../types/index.ts'", "'../../types/index.ts'"],
  ["'../data/mockStore.ts'", "'../../data/mockStore.ts'"]
]);

// src/components/landing/*
const landingFiles = fs.readdirSync('src/components/landing').map(f => path.join('src/components/landing', f));
for (const file of landingFiles) {
  if (file.endsWith('.tsx')) {
    replaceInFile(file, [
      ["'../TeleiosLogo.tsx'", "'../common/TeleiosLogo.tsx'"]
    ]);
  }
}

// admin views and modals
const viewsFiles = fs.readdirSync('src/components/admin/views').map(f => path.join('src/components/admin/views', f));
const modalsFiles = fs.readdirSync('src/components/admin/modals').map(f => path.join('src/components/admin/modals', f));

for (const file of [...viewsFiles, ...modalsFiles]) {
  if (file.endsWith('.tsx')) {
    replaceInFile(file, [
      ["'../types/index.ts'", "'../../../types/index.ts'"],
      ["'./UserManagementModal.tsx'", "'../modals/UserManagementModal.tsx'"],
      ["'../services/security.service.ts'", "'../../../services/security.service.ts'"],
      ["'../data/mockStore.ts'", "'../../../data/mockStore.ts'"]
    ]);
  }
}
