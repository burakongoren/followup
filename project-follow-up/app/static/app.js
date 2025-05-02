document.addEventListener("DOMContentLoaded", async () => {
  const projectsContainer = document.getElementById("projectsContainer");
  const addProjectBtn = document.getElementById("addProjectBtn");
  const projectNameInput = document.getElementById("projectName");
  const projectOwnerInput = document.getElementById("projectOwner");
  const ownerFilterContainer = document.getElementById("ownerFilterContainer");
  
  // Tüm seçili proje sorumlularını takip etmek için
  let selectedOwners = new Set();
  let allOwners = [];
  
  // Görev ekleme modalı için
  let activeProjectId = null;
  
  // Tamamlanmış görevlerin görünürlüğünü takip etmek için
  const showCompletedTasksMap = {};
  
  // Açık/kapalı projeleri takip etmek için
  const expandedProjectsMap = {};

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
    const owner = projectOwnerInput.value.trim().toUpperCase();

    if (!name) {
      alert("Proje adı zorunlu.");
      return;
    }

    try {
      const result = await fetchData("/api/projects", {
        method: "POST",
        body: { name, owner },
      });

      projectNameInput.value = "";
      projectOwnerInput.value = "";
      
      // Yeni eklenen projeyi otomatik olarak aç
      expandedProjectsMap[result.id] = true;
      
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
      
      // Proje sorumlusu filtrelerine göre filtreleme
      let filteredProjects;
      
      // Eğer hiç filtre seçilmemiş veya "Hepsi" seçeneği seçilmişse tüm projeleri göster
      if (selectedOwners.size === 0 || selectedOwners.has("all")) {
        filteredProjects = allProjects;
      } else {
        // Sadece seçili proje sorumlularının projelerini göster
        filteredProjects = allProjects.filter(project => 
          selectedOwners.has(project.owner)
        );
      }

      renderProjects(filteredProjects);
      renderOwnerFilterOptions(allProjects);
    } catch (error) {
      console.error("Veri yüklenirken hata:", error);
      renderError();
    }
  }

  // === PROJE SORUMLUSU FİLTRELERİ ===
  function renderOwnerFilterOptions(projects) {
    if (!ownerFilterContainer) return;

    // Benzersiz proje sorumlularını bul
    allOwners = [...new Set(projects.map(p => p.owner).filter(Boolean))];
    
    // İlk kez oluşturuluyorsa, "Hepsi" seçeneğini varsayılan olarak ekle
    if (selectedOwners.size === 0) {
      selectedOwners.add("all");
    }
    
    // Filtreleme konteynerini temizle
    ownerFilterContainer.innerHTML = "";
    
    // "Hepsi" seçeneğini ekle
    const allLabel = document.createElement("label");
    allLabel.className = "owner-filter-option";
    
    const allCheckbox = document.createElement("input");
    allCheckbox.type = "checkbox";
    allCheckbox.value = "all";
    allCheckbox.checked = selectedOwners.has("all");
    allCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        // "Hepsi" seçildiğinde diğer tüm seçenekleri temizle
        selectedOwners.clear();
        selectedOwners.add("all");
      } else {
        // En az bir filtre seçili olmalı
        if (selectedOwners.size <= 1) {
          e.target.checked = true;
          return;
        }
        selectedOwners.delete("all");
      }
      loadAndRenderProjects();
    });
    
    allLabel.appendChild(allCheckbox);
    allLabel.appendChild(document.createTextNode(" Hepsi"));
    ownerFilterContainer.appendChild(allLabel);
    
    // Her proje sorumlusu için checkbox ekle
    allOwners.forEach(owner => {
      const ownerLabel = document.createElement("label");
      ownerLabel.className = "owner-filter-option";
      
      const ownerCheckbox = document.createElement("input");
      ownerCheckbox.type = "checkbox";
      ownerCheckbox.value = owner;
      ownerCheckbox.checked = selectedOwners.has(owner);
      ownerCheckbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          // Bir proje sorumlusu seçildiğinde "Hepsi" seçeneğini kaldır
          selectedOwners.delete("all");
          selectedOwners.add(owner);
        } else {
          // Hiç seçili filtre kalmazsa "Hepsi" seçeneğini seç
          selectedOwners.delete(owner);
          if (selectedOwners.size === 0) {
            selectedOwners.add("all");
          }
        }
        loadAndRenderProjects();
      });
      
      ownerLabel.appendChild(ownerCheckbox);
      ownerLabel.appendChild(document.createTextNode(` ${owner}`));
      ownerFilterContainer.appendChild(ownerLabel);
    });
  }

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
      projectElement.setAttribute("data-project-id", project.id);
      
      // Her proje için tamamlanmış görevlerin görünürlüğünü izle
      if (showCompletedTasksMap[project.id] === undefined) {
        showCompletedTasksMap[project.id] = false;
      }
      
      // Projenin açık/kapalı durumunu takip et
      if (expandedProjectsMap[project.id] === undefined) {
        expandedProjectsMap[project.id] = false; // Başlangıçta tüm projeler kapalı
      }
      
      // Tamamlanmış görev sayısını bul
      const completedTasksCount = project.tasks.filter(task => task.status === "Done").length;
      const activeTasks = project.tasks.filter(task => task.status !== "Done").length;
      const buttonText = showCompletedTasksMap[project.id] ? 
        "Tamamlanmış Görevleri Gizle" : 
        `Tamamlanmış Görevleri Göster (${completedTasksCount})`;
      
      // Açık/kapalı durumuna göre CSS class'ı ekle
      projectElement.classList.add(expandedProjectsMap[project.id] ? "expanded" : "collapsed");

      projectElement.innerHTML = `
        <div class="project-header" data-project-id="${project.id}">
          <div class="project-info">
            <div class="project-toggle">
              <span class="toggle-icon">${expandedProjectsMap[project.id] ? '▼' : '▶'}</span>
            </div>
            <div>
              <h3 class="project-title">${project.name}</h3>
              <p class="project-owner">Sorumlu: ${project.owner || "Belirtilmemiş"}</p>
            </div>
            <div class="tasks-count">
              <span class="active-tasks">${activeTasks} aktif görev</span>
              ${completedTasksCount > 0 ? `<span class="completed-tasks">${completedTasksCount} tamamlandı</span>` : ''}
            </div>
          </div>
          <div class="project-actions">
            <button class="toggle-completed-btn" data-project-id="${project.id}">${buttonText}</button>
            <button class="edit-project-btn" data-project-id="${project.id}" data-project-name="${project.name}" data-project-owner="${project.owner || ""}">Düzenle</button>
            <button class="add-task-btn" data-project-id="${project.id}">Görev Ekle</button>
            <button class="delete-project-btn" data-project-id="${project.id}">Sil</button>
          </div>
        </div>
        <div class="project-content" style="display: ${expandedProjectsMap[project.id] ? 'block' : 'none'}">
          <div class="meeting-form-container" id="meeting-form-${project.id}" style="display: none;">
            <div class="meeting-form">
              <h3>Yeni Görev Ekle</h3>
              <div class="form-row">
                <input type="number" placeholder="Yıl" class="year-input" min="2000" max="2100" value="${new Date().getFullYear()}" />
                <input type="number" placeholder="Hafta" class="week-input" min="1" max="53" value="${Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000) + 1}" />
              </div>
              <div class="form-row">
                <input type="text" placeholder="Görev başlığı" class="task-title-input" />
              </div>
              <div class="form-row form-actions">
                <button class="save-task-btn" data-project-id="${project.id}">Ekle</button>
                <button class="cancel-btn" data-project-id="${project.id}">İptal</button>
              </div>
            </div>
          </div>
          <div class="tasks-container" id="tasks-${project.id}"></div>
        </div>
      `;

      projectsContainer.appendChild(projectElement);
      
      // Sadece açık olan projelerin görevlerini render et
      if (expandedProjectsMap[project.id]) {
        renderCombinedTasks(project);
      }
    });

    setupEventListeners();
  }

  // === GÖREVLERİ VE TOPLANTILARI BİRLİKTE GÖSTER ===
  function renderCombinedTasks(project) {
    const tasksContainer = document.getElementById(`tasks-${project.id}`);
    tasksContainer.innerHTML = "";
    
    // Tamamlanmış görevleri göster/gizle durumuna göre filtrele
    const showCompleted = showCompletedTasksMap[project.id] || false;
    const filteredTasks = showCompleted ? 
      project.tasks : 
      project.tasks.filter(task => task.status !== "Done");
    
    if (filteredTasks.length === 0) {
      tasksContainer.innerHTML = `
        <div class="empty-state">
          <p>Bu projede henüz ${showCompleted ? "" : "aktif"} görev yok.</p>
        </div>`;
      return;
    }
    
    // Toplantı tarihlerine göre gruplanmış görevleri hazırla
    const meetingWeeks = Object.keys(project.meetings || {}).sort((a, b) => {
      const [yearA, weekA] = a.split("-").map(Number);
      const [yearB, weekB] = b.split("-").map(Number);
      return yearA !== yearB ? yearB - yearA : weekB - weekA; // En son toplantılar üstte
    });
    
    // Toplantı haftası bilgilerini içeren bir nesnede görevleri topla
    const tasksByMeeting = {};
    meetingWeeks.forEach(week => {
      tasksByMeeting[week] = [];
    });
    
    // Her görevi ilgili toplantı haftasına ekle (veya diğer görevler kategorisine)
    filteredTasks.forEach(task => {
      let assigned = false;
      
      // Toplantı notlarına bak ve görevin hangi toplantıda eklendiğini bul
      for (const week of meetingWeeks) {
        const note = project.meetings[week];
        // Eğer toplantı notlarında görev başlığı geçiyorsa, o toplantıya ait
        if (note.includes(task.title)) {
          tasksByMeeting[week].push(task);
          assigned = true;
          break;
        }
      }
      
      // Eğer herhangi bir toplantıya atanmadıysa, "other" kategorisine ekle
      if (!assigned) {
        if (!tasksByMeeting["other"]) {
          tasksByMeeting["other"] = [];
        }
        tasksByMeeting["other"].push(task);
      }
    });
    
    // Her toplantı haftası için görevleri göster
    for (const week in tasksByMeeting) {
      if (tasksByMeeting[week].length === 0) continue;
      
      const sectionDiv = document.createElement("div");
      sectionDiv.className = "tasks-section";
      
      if (week !== "other") {
        const [year, weekNum] = week.split("-");
        const meetingNote = project.meetings[week];
        
        // Toplantı başlığı
        const headerDiv = document.createElement("div");
        headerDiv.className = "tasks-section-header";
        headerDiv.innerHTML = `
          <div class="week-info">
            <h3>${year} / ${weekNum}. Hafta</h3>
            <div class="meeting-actions">
              <button class="delete-meeting-btn" data-project-id="${project.id}" data-week="${week}">Haftayı Sil</button>
            </div>
          </div>
          <div class="meeting-note-preview">
            ${meetingNote.split("\n").filter(line => !line.includes("- ")).join("<br>")}
          </div>
        `;
        sectionDiv.appendChild(headerDiv);
      } else {
        // Diğer görevler için başlık
        const headerDiv = document.createElement("div");
        headerDiv.className = "tasks-section-header";
        headerDiv.innerHTML = `<h3>Diğer Görevler</h3>`;
        sectionDiv.appendChild(headerDiv);
      }
      
      // Bu toplantıdaki görevleri göster
      const tasksList = document.createElement("div");
      tasksList.className = "tasks-list";
      
      tasksByMeeting[week].forEach(task => {
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
        tasksList.appendChild(taskElement);
      });
      
      sectionDiv.appendChild(tasksList);
      tasksContainer.appendChild(sectionDiv);
    }
  }

  // === BUTONLARI BAĞLA ===
  function setupEventListeners() {
    // Proje başlığına tıklandığında açılıp kapanma
    document.querySelectorAll(".project-header").forEach((header) => {
      header.addEventListener("click", async (e) => {
        // Butonlara tıklanırsa proje açma/kapama yapma
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
          return;
        }
        
        const projectId = header.getAttribute("data-project-id");
        const projectElement = header.closest('.project');
        const projectContent = projectElement.querySelector('.project-content');
        const toggleIcon = header.querySelector('.toggle-icon');
        
        // Açık/kapalı durumunu değiştir
        expandedProjectsMap[projectId] = !expandedProjectsMap[projectId];
        
        // UI'ı güncelle
        if (expandedProjectsMap[projectId]) {
          projectElement.classList.remove('collapsed');
          projectElement.classList.add('expanded');
          projectContent.style.display = 'block';
          toggleIcon.textContent = '▼';
          
          // İçeriği yeniden render et
          try {
            // Projenin güncel verilerini çek
            const projectData = await fetchData(`/api/projects/${projectId}`);
            // Görevleri render et
            renderCombinedTasks(projectData);
          } catch (error) {
            console.error("Proje verileri yüklenirken hata:", error);
          }
        } else {
          projectElement.classList.remove('expanded');
          projectElement.classList.add('collapsed');
          projectContent.style.display = 'none';
          toggleIcon.textContent = '▶';
        }
      });
    });
    
    // Tamamlanmış Görevleri Göster/Gizle butonları
    document.querySelectorAll(".toggle-completed-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Butonun proje başlığındaki tıklama olayını tetiklemesini önle
        const projectId = e.target.getAttribute("data-project-id");
        // Görünürlük durumunu değiştir
        showCompletedTasksMap[projectId] = !showCompletedTasksMap[projectId];
        // Projeleri yeniden yükle
        loadAndRenderProjects();
      });
    });
    
    // Görev Ekle butonları
    document.querySelectorAll(".add-task-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Butonun proje başlığındaki tıklama olayını tetiklemesini önle
        const projectId = e.target.getAttribute("data-project-id");
        const meetingForm = document.getElementById(`meeting-form-${projectId}`);
        
        // Diğer tüm formları gizle
        document.querySelectorAll(".meeting-form-container").forEach(form => {
          form.style.display = "none";
        });
        
        // Projenin açık olduğundan emin ol
        if (!expandedProjectsMap[projectId]) {
          const projectHeader = document.querySelector(`.project-header[data-project-id="${projectId}"]`);
          projectHeader.click();
        }
        
        // Bu projenin formunu göster
        meetingForm.style.display = "block";
        activeProjectId = projectId;
      });
    });
    
    // Düzenle ve Sil butonları için stopPropagation ekle
    document.querySelectorAll(".edit-project-btn, .delete-project-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Butonun proje başlığındaki tıklama olayını tetiklemesini önle
      });
    });

    // Görev Ekle İptal butonları
    document.querySelectorAll(".cancel-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Event propagation'ı durdur
        const projectId = e.target.getAttribute("data-project-id");
        const meetingForm = document.getElementById(`meeting-form-${projectId}`);
        meetingForm.style.display = "none";
        activeProjectId = null;
      });
    });

    // Görev Kaydet butonları
    document.querySelectorAll(".save-task-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation(); // Event propagation'ı durdur
        const projectId = e.target.getAttribute("data-project-id");
        const form = document.getElementById(`meeting-form-${projectId}`);
        
        const yearInput = form.querySelector(".year-input");
        const weekInput = form.querySelector(".week-input");
        const titleInput = form.querySelector(".task-title-input");
        
        const year = yearInput.value.trim();
        const week = weekInput.value.trim();
        const title = titleInput.value.trim();
        
        if (!year || !week || !title) {
          alert("Yıl, hafta ve görev başlığı alanları zorunludur");
          return;
        }
        
        // Hafta numarasının 2 basamaklı olmasını sağla
        const weekKey = `${year}-${week.padStart(2, '0')}`;
        
        try {
          // Önce görevi ekle
          await fetchData(`/api/projects/${projectId}/tasks`, {
            method: "POST",
            body: { title }
          });
          
          // Sonra toplantı notunu ekle veya güncelle
          const projectData = await fetchData(`/api/projects/${projectId}`);
          const meetings = projectData.meetings || {};
          
          // Eğer aynı hafta için bir not varsa, sonuna görev adını ekle
          const existingNote = meetings[weekKey] || "";
          const updatedNote = existingNote ? 
            `${existingNote}\n- ${title}` : 
            `- ${title}`;
          
          await fetchData(`/api/projects/${projectId}/meetings`, {
            method: "PUT",
            body: { week: weekKey, note: updatedNote }
          });
          
          // Formu temizle ve gizle
          titleInput.value = "";
          form.style.display = "none";
          
          // Projeleri yeniden yükle
          await loadAndRenderProjects();
        } catch (error) {
          console.error("Görev eklenirken hata:", error);
          alert("Görev eklenirken bir hata oluştu");
        }
      });
    });

    // Toplantı Sil butonları
    document.querySelectorAll(".delete-meeting-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation(); // Event propagation'ı durdur
        const projectId = e.target.getAttribute("data-project-id");
        const weekKey = e.target.getAttribute("data-week");
        const [year, week] = weekKey.split("-");
        
        if (confirm(`${year} / ${week}. hafta toplantı notlarını silmek istiyor musunuz? (Görevler silinmeyecek)`)) {
          await fetchData(`/api/projects/${projectId}/meetings`, {
            method: "PUT",
            body: { week: weekKey, note: null }
          });
          
          await loadAndRenderProjects();
        }
      });
    });
    
    // Proje Düzenle butonları
    document.querySelectorAll(".edit-project-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation(); // Event propagation'ı durdur
        const projectId = e.target.getAttribute("data-project-id");
        const currentName = e.target.getAttribute("data-project-name");
        const currentOwner = e.target.getAttribute("data-project-owner");
        
        const newName = prompt("Proje adı:", currentName);
        if (!newName || newName.trim() === "") return;
        
        const newOwner = prompt("Proje sorumlusu:", currentOwner);
        
        await fetchData(`/api/projects/${projectId}`, {
          method: "PUT", 
          body: { 
            name: newName.trim(), 
            owner: newOwner ? newOwner.trim().toUpperCase() : "" // Uppercase for consistency
          }
        });
        
        await loadAndRenderProjects();
      });
    });

    // Proje Sil butonları
    document.querySelectorAll(".delete-project-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation(); // Event propagation'ı durdur
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
