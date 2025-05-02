document.addEventListener("DOMContentLoaded", async () => {
  const projectsContainer = document.getElementById("projectsContainer");
  const addProjectBtn = document.getElementById("addProjectBtn");
  const projectNameInput = document.getElementById("projectName");
  const projectOwnerInput = document.getElementById("projectOwner");
  const ownerFilter = document.getElementById("ownerFilter");

  async function fetchData(url, options = {}) {
    const response = await fetch(`http://localhost:5000${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return response.json();
  }

  // === PROJE EKLE ===
  addProjectBtn.addEventListener("click", async () => {
    const name = projectNameInput.value.trim();
    const owner = projectOwnerInput.value.trim();

    if (!name) {
      alert("Proje adı zorunlu.");
      return;
    }

    try {
      await fetchData("/api/projects", {
        method: "POST",
        body: { name, owner },
      });

      projectNameInput.value = "";
      projectOwnerInput.value = "";
      await loadAndRenderProjects();
    } catch (error) {
      console.error("Proje eklenirken hata:", error);
      alert("Proje eklenirken bir hata oluştu");
    }
  });

  // === PROJELERİ YÜKLE ===
  async function loadAndRenderProjects() {
    try {
      const data = await fetchData("/api/projects");
      const allProjects = data.projects;
      const selectedOwner = ownerFilter?.value || "";

      const filtered = selectedOwner
        ? allProjects.filter((p) => p.owner === selectedOwner)
        : allProjects;

      renderProjects(filtered);
      renderOwnerFilterOptions(allProjects);
    } catch (error) {
      console.error("Veri yüklenirken hata:", error);
      renderError();
    }
  }

  // === PROJE SORUMLUSU FİLTRELERİ ===
  function renderOwnerFilterOptions(projects) {
    if (!ownerFilter) return;

    const uniqueOwners = [...new Set(projects.map(p => p.owner).filter(Boolean))];
    ownerFilter.innerHTML = '<option value="">Hepsi</option>';
    uniqueOwners.forEach(owner => {
      ownerFilter.innerHTML += `<option value="${owner}">${owner}</option>`;
    });
  }

  ownerFilter?.addEventListener("change", loadAndRenderProjects);

  // === PROJELERİ GÖSTER ===
  function renderProjects(projects) {
    projectsContainer.innerHTML = "";

    if (projects.length === 0) {
      projectsContainer.innerHTML = `
        <div class="empty-state">
          <p>Henüz hiç proje eklenmedi.</p>
        </div>`;
      return;
    }

    projects.forEach((project) => {
      const projectElement = document.createElement("div");
      projectElement.className = "project";

      projectElement.innerHTML = `
        <div class="project-header">
          <div>
            <h3 class="project-title">${project.name}</h3>
            <p class="project-owner">Sorumlu: ${project.owner || "Belirtilmemiş"}</p>
          </div>
          <div class="project-actions">
            <button class="add-task-btn" data-project-id="${project.id}">Görev Ekle</button>
            <button class="view-project-btn" onclick="window.location.href='project.html?id=${project.id}'">Toplantılar</button>
            <button class="delete-project-btn" data-project-id="${project.id}">Sil</button>
          </div>
        </div>
        <div class="tasks-container" id="tasks-${project.id}"></div>
      `;

      projectsContainer.appendChild(projectElement);
      renderTasks(project);
    });

    setupEventListeners();
  }

  // === GÖREVLERİ GÖSTER ===
  function renderTasks(project) {
    const tasksContainer = document.getElementById(`tasks-${project.id}`);
    tasksContainer.innerHTML = "";

    if (project.tasks.length === 0) {
      tasksContainer.innerHTML = `
        <div class="empty-state">
          <p>Bu projede henüz görev yok.</p>
        </div>`;
      return;
    }

    project.tasks.forEach((task) => {
      const taskElement = document.createElement("div");
      taskElement.className = `task ${task.status.toLowerCase().replace(" ", "-")}`;
      taskElement.innerHTML = `
        <div class="task-info">
          <div class="task-title">${task.title}</div>
          <div class="task-status">Durum: ${task.status}</div>
        </div>
        <div class="task-actions">
          <select class="status-select" data-task-id="${task.id}">
            <option value="To Do" ${task.status === "To Do" ? "selected" : ""}>To Do</option>
            <option value="In Progress" ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option value="Done" ${task.status === "Done" ? "selected" : ""}>Done</option>
          </select>
          <button class="edit-task-btn" data-task-id="${task.id}">Düzenle</button>
          <button class="delete-task-btn" data-task-id="${task.id}">Sil</button>
        </div>
      `;
      tasksContainer.appendChild(taskElement);
    });
  }

  // === BUTONLARI BAĞLA ===
  function setupEventListeners() {
    document.querySelectorAll(".add-task-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const projectId = e.target.getAttribute("data-project-id");
        const title = prompt("Görev başlığı girin:");
        if (title) {
          await fetchData(`/api/projects/${projectId}/tasks`, {
            method: "POST",
            body: { title },
          });
          await loadAndRenderProjects();
        }
      });
    });

    document.querySelectorAll(".delete-project-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const projectId = e.target.getAttribute("data-project-id");
        if (confirm("Projeyi silmek istediğinize emin misiniz?")) {
          await fetchData(`/api/projects/${projectId}`, {
            method: "DELETE",
          });
          await loadAndRenderProjects();
        }
      });
    });

    document.querySelectorAll(".status-select").forEach((select) => {
      select.addEventListener("change", async (e) => {
        const taskId = e.target.getAttribute("data-task-id");
        const status = e.target.value;
        await fetchData(`/api/tasks/${taskId}`, {
          method: "PUT",
          body: { status },
        });
        await loadAndRenderProjects();
      });
    });

    document.querySelectorAll(".edit-task-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const taskId = e.target.getAttribute("data-task-id");
        const newTitle = prompt("Yeni görev başlığı:");
        if (newTitle && newTitle.trim()) {
          await fetchData(`/api/tasks/${taskId}`, {
            method: "PUT",
            body: { title: newTitle.trim() },
          });
          await loadAndRenderProjects();
        }
      });
    });

    document.querySelectorAll(".delete-task-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const taskId = e.target.getAttribute("data-task-id");
        if (confirm("Görevi silmek istediğinize emin misiniz?")) {
          await fetchData(`/api/tasks/${taskId}`, {
            method: "DELETE",
          });
          await loadAndRenderProjects();
        }
      });
    });
  }

  function renderError() {
    projectsContainer.innerHTML = `
      <div class="empty-state error">
        <p>Backend servisine ulaşılamıyor. Lütfen Python backend'inin çalıştığından emin olun.</p>
      </div>`;
  }

  // İlk yükleme
  await loadAndRenderProjects();
});
