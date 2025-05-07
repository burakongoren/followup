document.addEventListener("DOMContentLoaded", async () => {
  const projectsContainer = document.getElementById("projectsContainer");
  const addProjectBtn = document.getElementById("addProjectBtn");
  const projectNameInput = document.getElementById("projectName");
  const projectOwnerInput = document.getElementById("projectOwner");
  const ownerFilterContainer = document.getElementById("ownerFilterContainer");
  const themeToggle = document.getElementById("themeToggle");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const toggleCompletedProjectsBtn = document.getElementById("toggleCompletedProjectsBtn");
  
  // Tüm seçili proje sorumlularını takip etmek için
  let selectedOwners = new Set();
  let allOwners = [];
  
  // Görev ekleme modalı için
  let activeProjectId = null;
  
  // Tamamlanmış görevlerin görünürlüğünü takip etmek için
  const showCompletedTasksMap = {};
  
  // Tamamlanmış projelerin görünürlüğünü takip etmek için
  let showCompletedProjects = false;
  
  // Açık/kapalı projeleri takip etmek için
  const expandedProjectsMap = {};
  
  // Tema ayarlarını yükle
  initializeTheme();

  // İlk yükleme sırasında loading spinner'ı göster
  showLoading(true);

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

  // === TEMA YÖNETİMİ ===
  function initializeTheme() {
    // Kayıtlı temayı localStorage'dan al, yoksa 'light' kullan
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    // Tema değiştirici butonu için event listener
    themeToggle.addEventListener('click', toggleTheme);
    
    // Buton metnini ve ikonunu güncelle
    updateThemeToggleDisplay(savedTheme);
  }
  
  function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
  }
  
  function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    setTheme(newTheme);
    updateThemeToggleDisplay(newTheme);
  }
  
  function updateThemeToggleDisplay(theme) {
    const icon = themeToggle.querySelector('.theme-toggle-icon');
    const text = themeToggle.querySelector('.theme-toggle-text');
    
    if (theme === 'dark') {
      icon.textContent = '🌙';
    } else {
      icon.textContent = '☀️';
    }
  }

  // Tamamlanmış projeleri göster/gizle
  if (toggleCompletedProjectsBtn) {
    toggleCompletedProjectsBtn.addEventListener("click", () => {
      showCompletedProjects = !showCompletedProjects;
      
      // Button metnini güncelle
      const buttonText = toggleCompletedProjectsBtn.querySelector("span");
      if (showCompletedProjects) {
        buttonText.textContent = "Tamamlanan Projeleri Gizle";
      } else {
        buttonText.textContent = "Tamamlanan Projeleri Göster";
      }
      
      loadAndRenderProjects();
    });
  }

  // Loading spinner göster/gizle
  function showLoading(show) {
    if (loadingSpinner) {
      loadingSpinner.style.display = show ? "flex" : "none";
    }
  }

  // === PROJE EKLE ===
  addProjectBtn.addEventListener("click", async () => {
    const name = projectNameInput.value.trim();
    const owner = projectOwnerInput.value.trim().toUpperCase();

    if (!name) {
      showNotification("Proje adı zorunlu.", "error");
      return;
    }

    try {
      // Loading spinner'ı göster
      showLoading(true);
      
      const result = await fetchData("/api/projects", {
        method: "POST",
        body: { name, owner, status: "In Progress" },
      });

      projectNameInput.value = "";
      projectOwnerInput.value = "";
      
      // Yeni eklenen projeyi otomatik olarak aç
      expandedProjectsMap[result.id] = true;
      
      await loadAndRenderProjects();
      
      // Başarılı bildirim göster
      showNotification(`"${name}" projesi başarıyla eklendi.`, "success");
    } catch (error) {
      console.error("Proje eklenirken hata:", error);
      showNotification("Proje eklenirken bir hata oluştu", "error");
    } finally {
      // Loading spinner'ı gizle
      showLoading(false);
    }
  });

  // === PROJELERİ YÜKLE ===
  async function loadAndRenderProjects() {
    try {
      showLoading(true);
      
      const data = await fetchData("/api/projects");
      let allProjects = data.projects;
      
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
      
      // Tamamlanmış projeleri filtrele
      if (!showCompletedProjects) {
        filteredProjects = filteredProjects.filter(project => 
          !project.status || project.status !== "Done"
        );
      }

      renderProjects(filteredProjects, allProjects);
      renderOwnerFilterOptions(allProjects);
      
      // Hiç proje yoksa boş durumu göster
      if (filteredProjects.length === 0) {
        renderEmptyState(allProjects.length === 0);
      }
    } catch (error) {
      console.error("Veri yüklenirken hata:", error);
      renderError();
    } finally {
      showLoading(false);
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

  // === PROJELERİ RENDER ET ===
  function renderProjects(projects, allProjects) {
    if (!projectsContainer) return;
    
    // Projeleri temizle
    projectsContainer.innerHTML = "";
    
    if (projects.length === 0) {
      renderEmptyState(allProjects.length === 0);
      return;
    }
    
    // Her proje için
    projects.forEach(project => {
      const projectElement = document.createElement("div");
      const isExpanded = expandedProjectsMap[project.id] || false;
      const statusClass = project.status ? project.status.toLowerCase().replace(/\s+/g, "-") : "in-progress";
      
      projectElement.className = `project ${isExpanded ? "expanded" : "collapsed"} ${statusClass}`;
      projectElement.dataset.projectId = project.id;
      
      // Proje header
      const projectHeader = document.createElement("div");
      projectHeader.className = "project-header";
      projectHeader.addEventListener("click", () => toggleProject(project.id));
      
      // Proje info
      const projectInfo = document.createElement("div");
      projectInfo.className = "project-info";
      
      // Toggle icon
      const projectToggle = document.createElement("div");
      projectToggle.className = "project-toggle";
      
      const toggleIcon = document.createElement("i");
      toggleIcon.className = `bx bx-chevron-right toggle-icon`;
      
      projectToggle.appendChild(toggleIcon);
      
      // Proje başlık
      const projectTitle = document.createElement("h3");
      projectTitle.className = "project-title";
      projectTitle.textContent = project.name;
      
      // Görev sayısı
      const activeTasks = project.tasks.filter(t => t.status !== "Done").length;
      const completedTasks = project.tasks.filter(t => t.status === "Done").length;
      
      const tasksCount = document.createElement("div");
      tasksCount.className = "tasks-count";
      
      const activeTasksSpan = document.createElement("span");
      activeTasksSpan.className = "active-tasks";
      activeTasksSpan.textContent = `${activeTasks}`;
      
      const totalTasksSpan = document.createElement("span");
      totalTasksSpan.textContent = ` / ${project.tasks.length} görev`;
      
      tasksCount.appendChild(activeTasksSpan);
      tasksCount.appendChild(totalTasksSpan);
      
      // Proje sorumlusu
      const projectOwner = document.createElement("div");
      projectOwner.className = "project-owner";
      projectOwner.textContent = project.owner || "Atanmamış";
      
      // Proje durumu
      const statusBadge = document.createElement("div");
      statusBadge.className = `status-badge ${statusClass}`;
      
      // Duruma göre ikon ekle
      let statusIcon = "";
      let statusText = "";
      
      switch(project.status) {
        case "Done":
          statusIcon = "bx bx-check-circle";
          statusText = "Tamamlandı";
          break;
        case "In Progress":
          statusIcon = "bx bx-time";
          statusText = "Devam Ediyor";
          break;
        case "On Hold":
          statusIcon = "bx bx-pause-circle";
          statusText = "Beklemede";
          break;
        default:
          statusIcon = "bx bx-loader-circle";
          statusText = project.status || "Belirsiz";
      }
      
      const statusIconElem = document.createElement("i");
      statusIconElem.className = statusIcon;
      statusBadge.appendChild(statusIconElem);
      
      const statusTextElem = document.createElement("span");
      statusTextElem.textContent = statusText;
      statusBadge.appendChild(statusTextElem);
      
      // Proje header'a elementleri ekle
      projectInfo.appendChild(projectToggle);
      projectInfo.appendChild(projectTitle);
      projectInfo.appendChild(tasksCount);
      projectInfo.appendChild(projectOwner);
      projectInfo.appendChild(statusBadge);
      
      // Proje actions
      const projectActions = document.createElement("div");
      projectActions.className = "project-actions";
      
      // Add task button
      const addTaskBtn = document.createElement("button");
      addTaskBtn.className = "icon-button add tooltip action-btn";
      addTaskBtn.setAttribute("data-tooltip", "Görev Ekle");
      addTaskBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleAddTaskForm(project.id);
      });
      
      const addTaskIcon = document.createElement("i");
      addTaskIcon.className = "bx bx-plus-circle";
      addTaskBtn.appendChild(addTaskIcon);
      
      // Edit project button
      const editProjectBtn = document.createElement("button");
      editProjectBtn.className = "icon-button edit tooltip action-btn";
      editProjectBtn.setAttribute("data-tooltip", "Projeyi Düzenle");
      editProjectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        editProject(project);
      });
      
      const editProjectIcon = document.createElement("i");
      editProjectIcon.className = "bx bx-edit";
      editProjectBtn.appendChild(editProjectIcon);
      
      // Delete project button
      const deleteProjectBtn = document.createElement("button");
      deleteProjectBtn.className = "icon-button delete tooltip action-btn";
      deleteProjectBtn.setAttribute("data-tooltip", "Projeyi Sil");
      deleteProjectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`"${project.name}" projesini silmek istediğinize emin misiniz?`)) {
          deleteProject(project.id);
        }
      });
      
      const deleteProjectIcon = document.createElement("i");
      deleteProjectIcon.className = "bx bx-trash";
      deleteProjectBtn.appendChild(deleteProjectIcon);
      
      // Toggle completed tasks button
      const toggleCompletedBtn = document.createElement("button");
      toggleCompletedBtn.className = "icon-button tooltip action-btn";
      toggleCompletedBtn.setAttribute("data-tooltip", completedTasks > 0 ? 
          (showCompletedTasksMap[project.id] ? "Tamamlanan Görevleri Gizle" : "Tamamlanan Görevleri Göster") : 
          "Tamamlanan Görev Yok");
      
      if (completedTasks > 0) {
        toggleCompletedBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleCompletedTasks(project.id);
        });
      } else {
        toggleCompletedBtn.disabled = true;
        toggleCompletedBtn.style.opacity = "0.5";
      }
      
      const toggleCompletedIcon = document.createElement("i");
      toggleCompletedIcon.className = "bx bx-check-square";
      toggleCompletedBtn.appendChild(toggleCompletedIcon);
      
      // Proje actions'a butonları ekle
      projectActions.appendChild(addTaskBtn);
      projectActions.appendChild(toggleCompletedBtn);
      projectActions.appendChild(editProjectBtn);
      projectActions.appendChild(deleteProjectBtn);
      
      // Başlangıçta butonları göster/gizle durumunu ayarla
      const actionButtons = projectActions.querySelectorAll('.action-btn');
      actionButtons.forEach(btn => {
        btn.style.display = isExpanded ? 'block' : 'none';
      });
      
      // Header'a info ve actions ekle
      projectHeader.appendChild(projectInfo);
      projectHeader.appendChild(projectActions);
      
      // Project content - görevler ve toplantılar
      const projectContent = document.createElement("div");
      projectContent.className = "project-content";
      
      // Görev ve toplantıları render et
      renderCombinedTasks(project, projectContent);
      
      // Proje elementine header ve content ekle
      projectElement.appendChild(projectHeader);
      projectElement.appendChild(projectContent);
      
      // Projeyi ana container'a ekle
      projectsContainer.appendChild(projectElement);
    });
  }

  // === BOŞ DURUM GÖRÜNÜMÜ ===
  function renderEmptyState(noProjects) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    
    const icon = document.createElement("i");
    icon.className = noProjects ? "bx bx-folder-open" : "bx bx-filter";
    emptyState.appendChild(icon);
    
    const message = document.createElement("p");
    message.textContent = noProjects ? 
      "Henüz hiç proje oluşturmadınız. Projelerinizi takip etmeye başlamak için yeni bir proje ekleyin." : 
      "Seçtiğiniz filtrelere uygun proje bulunamadı. Lütfen farklı filtreler deneyin veya yeni proje ekleyin.";
    emptyState.appendChild(message);
    
    if (noProjects) {
      const addButton = document.createElement("button");
      addButton.innerHTML = '<i class="bx bx-plus"></i> Yeni Proje Ekle';
      addButton.addEventListener("click", () => {
        // Kullanıcıyı input alanına odakla
        projectNameInput.focus();
      });
      emptyState.appendChild(addButton);
    }
    
    projectsContainer.appendChild(emptyState);
  }

  // === HATA DURUMU GÖRÜNÜMÜ ===
  function renderError() {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.innerHTML = `
      <i class="bx bx-error-circle" style="font-size: 32px; margin-bottom: 12px;"></i>
      <p>Veriler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.</p>
      <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: var(--blue-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
        <i class="bx bx-refresh"></i> Sayfayı Yenile
      </button>
    `;
    projectsContainer.appendChild(errorDiv);
  }

  // === BİLDİRİM GÖSTER ===
  function showNotification(message, type = "info") {
    // Daha önce oluşturulmuş bildirim container'ı var mı kontrol et
    let notificationContainer = document.querySelector(".notification-container");
    
    // Yoksa oluştur
    if (!notificationContainer) {
      notificationContainer = document.createElement("div");
      notificationContainer.className = "notification-container";
      document.body.appendChild(notificationContainer);
    }
    
    // Yeni bildirim oluştur
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    
    // İkon ekle
    const icon = document.createElement("i");
    if (type === "success") {
      icon.className = "bx bx-check-circle";
    } else if (type === "error") {
      icon.className = "bx bx-error-circle";
    } else {
      icon.className = "bx bx-info-circle";
    }
    
    // Mesaj ve kapat butonu
    notification.innerHTML = `
      <div class="notification-content">
        ${icon.outerHTML}
        <span>${message}</span>
      </div>
      <button class="notification-close"><i class="bx bx-x"></i></button>
    `;
    
    // Kapat butonuna olay ekle
    notification.querySelector(".notification-close").addEventListener("click", () => {
      notification.classList.add("hide");
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
    
    // Container'a ekle
    notificationContainer.appendChild(notification);
    
    // Otomatik kapanma
    setTimeout(() => {
      notification.classList.add("hide");
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  }

  // === GÖREV VE TOPLANTI İÇERİKLERİNİ RENDER ET ===
  function renderCombinedTasks(project, projectContentElement) {
    // Önce açılış toplantısı içeriğini ekle (varsa)
    if (project.meetings && Object.keys(project.meetings).length > 0) {
      // Toplantılar bölümü
      renderMeetingNotes(project, projectContentElement);
    }
    
    // Görevler için container
    const tasksWrapper = document.createElement("div");
    tasksWrapper.className = "tasks-wrapper";
    
    // Görev ekleme butonu
    const addTaskButton = document.createElement("button");
    addTaskButton.className = "add-task-btn";
    addTaskButton.innerHTML = '<i class="bx bx-plus-circle"></i> Yeni Görev Ekle';
    addTaskButton.addEventListener("click", () => toggleAddTaskForm(project.id));
    
    tasksWrapper.appendChild(addTaskButton);
    
    // Görev formu için container (başlangıçta gizli)
    const taskFormContainer = document.createElement("div");
    taskFormContainer.className = "meeting-form-container";
    taskFormContainer.id = `taskForm-${project.id}`;
    taskFormContainer.style.display = "none";
    
    const taskForm = document.createElement("form");
    taskForm.className = "meeting-form";
    taskForm.innerHTML = `
      <h3><i class="bx bx-list-plus"></i> Yeni Görev Ekle</h3>
      <div class="form-row">
        <input type="text" id="taskTitle-${project.id}" placeholder="Görev başlığı" required>
      </div>
      <div class="form-actions">
        <button type="button" class="cancel-btn" onclick="document.getElementById('taskForm-${project.id}').style.display='none'">
          <i class="bx bx-x"></i> İptal
        </button>
        <button type="submit" class="save-task-btn">
          <i class="bx bx-check"></i> Kaydet
        </button>
      </div>
    `;
    
    taskForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const titleInput = document.getElementById(`taskTitle-${project.id}`);
      const title = titleInput.value.trim();
      
      if (title) {
        addTask(project.id, title);
        titleInput.value = "";
        taskFormContainer.style.display = "none";
      }
    });
    
    taskFormContainer.appendChild(taskForm);
    tasksWrapper.appendChild(taskFormContainer);
    
    // Görevleri render et
    if (project.tasks && project.tasks.length > 0) {
      // Görevleri aktif ve tamamlanmış olarak ayır
      const activeTasks = project.tasks.filter(task => task.status !== "Done");
      const completedTasks = project.tasks.filter(task => task.status === "Done");
      
      // Aktif görevleri her zaman göster
      if (activeTasks.length > 0) {
        const tasksContainer = document.createElement("div");
        tasksContainer.className = "tasks-list";
        
        activeTasks.forEach(task => {
          tasksContainer.appendChild(createTaskElement(task, project.id));
        });
        
        tasksWrapper.appendChild(tasksContainer);
      } else if (project.tasks.length > 0) {
        // Tüm görevler tamamlanmışsa
        const noActiveTasksMsg = document.createElement("p");
        noActiveTasksMsg.className = "empty-state";
        noActiveTasksMsg.innerHTML = `<i class="bx bx-check-circle"></i><span>Tüm görevler tamamlandı!</span>`;
        tasksWrapper.appendChild(noActiveTasksMsg);
      }
      
      // Tamamlanmış görevleri gösterme/gizleme kontrolü
      if (completedTasks.length > 0) {
        const showCompleted = showCompletedTasksMap[project.id] || false;
        
        if (showCompleted) {
          const completedTasksContainer = document.createElement("div");
          completedTasksContainer.className = "tasks-list completed-tasks-list";
          
          const completedHeader = document.createElement("h4");
          completedHeader.className = "completed-tasks-header";
          completedHeader.innerHTML = `<i class="bx bx-check-double"></i> Tamamlanan Görevler (${completedTasks.length})`;
          completedTasksContainer.appendChild(completedHeader);
          
          completedTasks.forEach(task => {
            completedTasksContainer.appendChild(createTaskElement(task, project.id));
          });
          
          tasksWrapper.appendChild(completedTasksContainer);
        }
      }
    } else {
      // Hiç görev yoksa
      const noTasksMsg = document.createElement("p");
      noTasksMsg.className = "empty-state";
      noTasksMsg.innerHTML = "Henüz görev eklenmemiş.";
      tasksWrapper.appendChild(noTasksMsg);
    }
    
    projectContentElement.appendChild(tasksWrapper);
  }
  
  // Toplantı notlarını render et
  function renderMeetingNotes(project, parentElement) {
    const meetings = project.meetings;
    
    if (!meetings || Object.keys(meetings).length === 0) return;
    
    const meetingsSection = document.createElement("div");
    meetingsSection.className = "tasks-section";
    
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "tasks-section-header";
    
    const headerTitle = document.createElement("h3");
    headerTitle.innerHTML = '<i class="bx bx-calendar-event"></i> Toplantı Notları';
    sectionHeader.appendChild(headerTitle);
    
    meetingsSection.appendChild(sectionHeader);
    
    const meetingsList = document.createElement("div");
    meetingsList.className = "tasks-list";
    
    // Toplantı notlarını haftaya göre sırala
    const meetingWeeks = Object.keys(meetings).sort((a, b) => a.localeCompare(b));
    
    meetingWeeks.forEach(week => {
      const note = meetings[week];
      
      const meetingItem = document.createElement("div");
      meetingItem.className = "meeting-item";
      
      const weekInfo = document.createElement("div");
      weekInfo.className = "week-info";
      
      const weekDate = document.createElement("strong");
      weekDate.textContent = `Hafta: ${week}`;
      
      const actions = document.createElement("div");
      actions.className = "meeting-actions";
      
      const editButton = document.createElement("button");
      editButton.className = "edit-meeting-btn";
      editButton.innerHTML = '<i class="bx bx-edit"></i> Düzenle';
      editButton.addEventListener("click", () => {
        // Toplantı düzenleme fonksiyonunu çağır
        editMeetingNote(project.id, week, note);
      });
      
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-meeting-btn";
      deleteButton.innerHTML = '<i class="bx bx-trash"></i> Sil';
      deleteButton.addEventListener("click", () => {
        if (confirm("Bu toplantı notunu silmek istediğinize emin misiniz?")) {
          deleteMeetingNote(project.id, week);
        }
      });
      
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      
      weekInfo.appendChild(weekDate);
      weekInfo.appendChild(actions);
      
      const notePreview = document.createElement("div");
      notePreview.className = "meeting-note-preview";
      notePreview.textContent = note;
      
      meetingItem.appendChild(weekInfo);
      meetingItem.appendChild(notePreview);
      
      meetingsList.appendChild(meetingItem);
    });
    
    meetingsSection.appendChild(meetingsList);
    parentElement.appendChild(meetingsSection);
  }
  
  // Görev elementi oluştur
  function createTaskElement(task, projectId) {
    const taskElement = document.createElement("div");
    taskElement.className = `task ${task.status ? task.status.toLowerCase().replace(/\s+/g, "-") : "todo"}`;
    taskElement.dataset.taskId = task.id;
    
    const taskInfo = document.createElement("div");
    taskInfo.className = "task-info";
    
    const taskTitle = document.createElement("h4");
    taskTitle.className = "task-title";
    taskTitle.textContent = task.title;
    
    const taskStatus = document.createElement("div");
    taskStatus.className = "task-status";
    
    // Duruma göre ikon ve metin
    let statusText = "";
    let statusIcon = "";
    
    switch(task.status) {
      case "Done":
        statusText = "Tamamlandı";
        statusIcon = "bx bx-check-circle";
        break;
      case "In Progress":
        statusText = "Devam Ediyor";
        statusIcon = "bx bx-time-five";
        break;
      case "To Do":
      default:
        statusText = "Yapılacak";
        statusIcon = "bx bx-clipboard";
        break;
    }
    
    taskStatus.innerHTML = `<i class="${statusIcon}"></i> ${statusText}`;
    
    // Tarih bilgisi ekleyelim (varsa)
    if (task.statusDate) {
      const taskDate = document.createElement("div");
      taskDate.className = "task-date";
      taskDate.innerHTML = `<i class="bx bx-calendar"></i> ${task.statusDate}`;
      taskInfo.appendChild(taskTitle);
      taskInfo.appendChild(taskStatus);
      taskInfo.appendChild(taskDate);
    } else {
      taskInfo.appendChild(taskTitle);
      taskInfo.appendChild(taskStatus);
    }
    
    const taskActions = document.createElement("div");
    taskActions.className = "task-actions";
    
    // Durum değiştirme select
    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select";
    statusSelect.innerHTML = `
      <option value="To Do" ${task.status === "To Do" ? "selected" : ""}>Yapılacak</option>
      <option value="In Progress" ${task.status === "In Progress" ? "selected" : ""}>Devam Ediyor</option>
      <option value="Done" ${task.status === "Done" ? "selected" : ""}>Tamamlandı</option>
    `;
    
    statusSelect.addEventListener("change", e => {
      updateTaskStatus(task.id, e.target.value);
    });
    
    // Silme butonu
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-task-btn";
    deleteBtn.innerHTML = '<i class="bx bx-trash"></i>';
    deleteBtn.addEventListener("click", () => {
      if (confirm("Bu görevi silmek istediğinize emin misiniz?")) {
        deleteTask(task.id);
      }
    });
    
    taskActions.appendChild(statusSelect);
    taskActions.appendChild(deleteBtn);
    
    taskElement.appendChild(taskInfo);
    taskElement.appendChild(taskActions);
    
    return taskElement;
  }
  
  // === GÖREV EKLEME FORMU AÇMA/KAPAMA ===
  function toggleAddTaskForm(projectId) {
    const formContainer = document.getElementById(`taskForm-${projectId}`);
    if (formContainer) {
      const isDisplayed = formContainer.style.display === "block";
      formContainer.style.display = isDisplayed ? "none" : "block";
      
      if (!isDisplayed) {
        activeProjectId = projectId;
        const input = document.getElementById(`taskTitle-${projectId}`);
        if (input) input.focus();
      } else {
        activeProjectId = null;
      }
    }
  }
  
  // === GÖREV İŞLEMLERİ ===
  async function addTask(projectId, title) {
    try {
      showLoading(true);
      
      // Günün tarihini alalım (GG.AA.YYYY formatında)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      
      // Tarih bilgisi
      const statusDate = `${day}.${month}.${year} tarihinde yapılacaklara eklendi`;
      
      await fetchData(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: { title, statusDate }
      });
      
      await loadAndRenderProjects();
      showNotification("Görev başarıyla eklendi", "success");
    } catch (error) {
      console.error("Görev eklenirken hata:", error);
      showNotification("Görev eklenirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  async function updateTaskStatus(taskId, status) {
    try {
      showLoading(true);
      
      // Günün tarihini alalım (GG.AA.YYYY formatında)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      
      // Durum bilgisi metni
      let statusText = "";
      switch(status) {
        case "Done":
          statusText = "tamamlandı";
          break;
        case "In Progress":
          statusText = "devam ediyor";
          break;
        case "To Do":
          statusText = "yapılacaklara eklendi";
          break;
      }
      
      // Tarih bilgisi
      const statusDate = `${day}.${month}.${year} tarihinde ${statusText}`;
      
      await fetchData(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: { status, statusDate }
      });
      
      await loadAndRenderProjects();
    } catch (error) {
      console.error("Görev güncellenirken hata:", error);
      showNotification("Görev güncellenirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  async function deleteTask(taskId) {
    try {
      showLoading(true);
      
      await fetchData(`/api/tasks/${taskId}`, {
        method: "DELETE"
      });
      
      await loadAndRenderProjects();
      showNotification("Görev başarıyla silindi", "success");
    } catch (error) {
      console.error("Görev silinirken hata:", error);
      showNotification("Görev silinirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  // === PROJE İŞLEMLERİ ===
  function toggleProject(projectId) {
    expandedProjectsMap[projectId] = !expandedProjectsMap[projectId];
    
    const projectElement = document.querySelector(`.project[data-project-id="${projectId}"]`);
    if (projectElement) {
      if (expandedProjectsMap[projectId]) {
        projectElement.classList.remove("collapsed");
        projectElement.classList.add("expanded");
        
        // Show action buttons when expanded
        const actionButtons = projectElement.querySelectorAll('.action-btn');
        actionButtons.forEach(btn => {
          btn.style.display = 'block';
        });
      } else {
        projectElement.classList.remove("expanded");
        projectElement.classList.add("collapsed");
        
        // Hide action buttons when collapsed
        const actionButtons = projectElement.querySelectorAll('.action-btn');
        actionButtons.forEach(btn => {
          btn.style.display = 'none';
        });
      }
    }
  }
  
  async function editProject(project) {
    // Proje düzenleme penceresini oluştur
    const name = prompt("Proje adını düzenleyin:", project.name);
    if (name === null) return; // İptal edildi
    
    const owner = prompt("Proje sorumlusunu düzenleyin:", project.owner);
    if (owner === null) return; // İptal edildi
    
    const statusOptions = ["In Progress", "On Hold", "Done"];
    const currentStatusIndex = statusOptions.indexOf(project.status);
    
    const statusPrompt = `Proje durumunu seçin:\n${statusOptions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    const statusSelection = prompt(statusPrompt, currentStatusIndex + 1);
    
    if (statusSelection === null) return; // İptal edildi
    
    const statusIndex = parseInt(statusSelection) - 1;
    const status = statusOptions[statusIndex] || project.status;
    
    try {
      showLoading(true);
      
      await fetchData(`/api/projects/${project.id}`, {
        method: "PUT",
        body: { name, owner, status }
      });
      
      await loadAndRenderProjects();
      showNotification("Proje başarıyla güncellendi", "success");
    } catch (error) {
      console.error("Proje güncellenirken hata:", error);
      showNotification("Proje güncellenirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  async function deleteProject(projectId) {
    try {
      showLoading(true);
      
      await fetchData(`/api/projects/${projectId}`, {
        method: "DELETE"
      });
      
      await loadAndRenderProjects();
      showNotification("Proje başarıyla silindi", "success");
    } catch (error) {
      console.error("Proje silinirken hata:", error);
      showNotification("Proje silinirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  // === TOPLANTI İŞLEMLERİ ===
  async function editMeetingNote(projectId, week, currentNote) {
    const newNote = prompt("Toplantı notunu düzenleyin:", currentNote);
    if (newNote === null) return; // İptal edildi
    
    try {
      showLoading(true);
      
      await fetchData(`/api/projects/${projectId}/meetings`, {
        method: "PUT",
        body: { week, note: newNote }
      });
      
      await loadAndRenderProjects();
      showNotification("Toplantı notu güncellendi", "success");
    } catch (error) {
      console.error("Toplantı notu güncellenirken hata:", error);
      showNotification("Toplantı notu güncellenirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  async function deleteMeetingNote(projectId, week) {
    try {
      showLoading(true);
      
      await fetchData(`/api/projects/${projectId}/meetings`, {
        method: "PUT",
        body: { week, note: null } // null değeri notu silmek için
      });
      
      await loadAndRenderProjects();
      showNotification("Toplantı notu silindi", "success");
    } catch (error) {
      console.error("Toplantı notu silinirken hata:", error);
      showNotification("Toplantı notu silinirken bir hata oluştu", "error");
    } finally {
      showLoading(false);
    }
  }
  
  // Tamamlanmış görevleri göster/gizle 
  function toggleCompletedTasks(projectId) {
    showCompletedTasksMap[projectId] = !showCompletedTasksMap[projectId];
    loadAndRenderProjects();
  }

  // Sayfayı yükle
  await loadAndRenderProjects();
  
  // Diğer Fonksiyonlar (görev ve proje yönetim fonksiyonları)
  // ... existing code ...
});
