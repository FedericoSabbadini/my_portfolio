/**
 * Template Renderer Module
 * Renders dynamic content from JSON data
 */

class TemplateRenderer {
    constructor() {
        this.templates = {};
    }

    /**
     * Render a template string with data
     * @param {string} template - Template string with {{placeholders}}
     * @param {Object} data - Data object
     * @returns {string}
     */
    render(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /**
     * Create HTML element from string
     * @param {string} html - HTML string
     * @returns {Element}
     */
    createElementFromHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html.trim();
        return div.firstChild;
    }

    /**
     * Render stats grid
     * @param {Array} stats - Stats array
     * @returns {string}
     */
    renderStats(stats) {
        return stats.map(stat => `
            <div class="stat-card">
                <span class="stat-number">${stat.number}</span>
                <span class="stat-label">${stat.label}</span>
                <span class="stat-sublabel">${stat.sublabel}</span>
            </div>
        `).join('');
    }

    /**
     * Render project cards
     * @param {Array} projects - Projects array
     * @param {boolean} showBadge - Whether to show badge
     * @returns {string}
     */
    renderProjects(projects, showBadge = false) {
        return projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    ${showBadge && project.badge ? `
                        <div class="project-badge">
                            <span class="badge ${project.badgeClass || 'badge-primary'}">${project.badge}</span>
                        </div>
                    ` : ''}
                    <h3 class="project-title">${project.title}</h3>
                    <span class="project-period">${project.period}</span>
                </div>
                <div class="project-body">
                    <p class="project-description">${project.description}</p>
                </div>
                <div class="tags">
                    ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${project.url ? `
                    <div class="project-footer">
                        <a href="${project.url}" target="_blank" class="link">${project.urlLabel || 'View on GitHub'}</a>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Render education timeline
     * @param {Array} education - Education array
     * @returns {string}
     */
    renderEducationTimeline(education) {
        return education.map(edu => `
            <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <span class="timeline-date">${edu.period}</span>
                    ${edu.statusLabel ? `
                        <span class="badge ${edu.statusBadge || 'badge-primary'}" style="margin-bottom: 0.5rem;">${edu.statusLabel}</span>
                    ` : ''}
                    <h3 class="timeline-title">${edu.degree}</h3>
                    <p class="timeline-subtitle">${edu.institution}${edu.gpa ? ` • ${edu.status === 'current' ? 'Current GPA' : 'Final Grade'}: ${edu.gpa}` : ''}</p>
                    <p style="color: var(--text-secondary); line-height: 1.7; margin-bottom: ${edu.thesis ? '1rem' : '0'}">
                        ${edu.description}
                    </p>
                    ${edu.thesis ? `
                        <a href="${edu.thesis.url}" target="_blank" class="link">View Bachelor's Thesis →</a>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Render work experience timeline
     * @param {Array} work - Work experience array
     * @returns {string}
     */
    renderWorkTimeline(work) {
        return work.map(job => `
            <div class="timeline-item ${job.status === 'upcoming' ? 'timeline-upcoming' : ''}">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <span class="timeline-date">${job.period}</span>
                    ${job.status === 'upcoming' ? `
                        <span class="badge badge-warning" style="margin-bottom: 0.5rem;">Upcoming</span>
                    ` : ''}
                    <h3 class="timeline-title">${job.title}</h3>
                    <p class="timeline-subtitle">${job.company}${job.location ? ` • ${job.location}` : ''}</p>
                    <p style="color: var(--text-secondary); line-height: 1.7; margin-bottom: ${job.responsibilities && job.responsibilities.length > 0 ? '1rem' : '0'}">
                        ${job.description}
                    </p>
                    ${job.responsibilities && job.responsibilities.length > 0 ? `
                        <ul class="work-responsibilities">
                            ${job.responsibilities.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    ` : ''}
                    ${job.technologies && job.technologies.length > 0 ? `
                        <div class="tags" style="margin-top: 1rem;">
                            ${job.technologies.map(tech => `<span class="tag">${tech}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Render languages
     * @param {Array} languages - Languages array
     * @returns {string}
     */
    renderLanguages(languages) {
        return languages.map(lang => `
            <div class="card language-card">
                <div class="language-content">
                    <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">${lang.flag} ${lang.name}</h3>
                    <p style="color: var(--text-light); margin-bottom: ${lang.detail ? '0.5rem' : '0'};">${lang.level}</p>
                    ${lang.detail ? `<p style="font-size: 0.875rem; color: var(--text-light);">${lang.detail}</p>` : ''}
                </div>
                <div class="language-bar">
                    <div class="language-fill" style="width: ${lang.percentage}%;"></div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render interests
     * @param {Array} interests - Interests array
     * @returns {string}
     */
    renderInterests(interests) {
        return interests.map(interest => `
            <div class="interest-card card">
                <div class="interest-icon">${interest.icon}</div>
                <h3 class="interest-title">${interest.title}</h3>
                <p class="interest-description">${interest.description}</p>
            </div>
        `).join('');
    }

    /**
     * Render courses
     * @param {Array} courses - Courses array
     * @param {string} type - 'master' or 'bachelor'
     * @returns {string}
     */
    renderCourses(courses, type = 'master') {
        return courses.map(course => `
            <div class="course-card ${type}">
                <div class="course-header">
                    <h3>${course.name}</h3>
                    <span class="course-grade">${course.grade}</span>
                </div>
                <div class="course-body">
                    <p class="course-description">${course.description}</p>
                </div>
                <div class="tags">
                    ${course.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${course.url ? `
                    <div class="course-footer">
                        <a href="${course.url}" target="_blank" class="link">View Details →</a>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Render featured projects (for home page - unified structure)
     * @param {Array} projects - Projects array
     * @returns {string}
     */
    renderFeaturedProjects(projects) {
        return projects.map(project => `
            <div class="featured-card featured-project">
                <div class="featured-badge">
                    <span class="badge ${project.badgeClass || 'badge-primary'}">${project.badge || 'Project'}</span>
                </div>
                <h3 class="featured-title">${project.title}</h3>
                <p class="featured-subtitle">${project.period}</p>
                <div class="featured-body">
                    <p class="featured-description">${project.description}</p>
                </div>
                <div class="tags">
                    ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${project.url ? `
                    <div class="featured-footer">
                        <a href="${project.url}" target="_blank" class="link">${project.urlLabel || 'View on GitHub →'}</a>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Render featured courses (for home page - unified structure)
     * @param {Array} courses - Courses array
     * @returns {string}
     */
    renderFeaturedCourses(courses) {
        return courses.map(course => `
            <div class="featured-card featured-course">
                <div class="featured-badge">
                    <span class="badge badge-success">Course</span>
                </div>
                <h3 class="featured-title">${course.name}</h3>
                <p class="featured-subtitle">Grade: ${course.grade}</p>
                <div class="featured-body">
                    <p class="featured-description">${course.description}</p>
                </div>
                <div class="tags">
                    ${course.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${course.url ? `
                    <div class="featured-footer">
                        <a href="${course.url}" target="_blank" class="link">View Details →</a>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Render featured certifications (for home page - unified structure)
     * @param {Array} certifications - Certifications array
     * @returns {string}
     */
    renderFeaturedCertifications(certifications) {
        return certifications.map(cert => `
            <div class="featured-card featured-cert">
                <div class="featured-badge">
                    <span class="badge badge-warning">Certification</span>
                </div>
                <h3 class="featured-title">${cert.title}</h3>
                <p class="featured-subtitle">${cert.issuer} • ${cert.date}</p>
                <div class="featured-body">
                    <p class="featured-description">${cert.description}</p>
                </div>
                <div class="tags">
                    ${cert.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${cert.url ? `
                    <div class="featured-footer">
                        <a href="${cert.url}" target="_blank" class="link">View Certificate →</a>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Render featured education (for home page - unified structure)
     * @param {Array} education - Education array
     * @returns {string}
     */
    renderFeaturedEducation(education) {
        return education.map(edu => `
            <div class="featured-card featured-education">
                <div class="featured-badge">
                    <span class="badge ${edu.statusBadge || 'badge-primary'}">${edu.statusLabel || 'Education'}</span>
                </div>
                <h3 class="featured-title">${edu.degree}</h3>
                <p class="featured-subtitle">${edu.institution} • ${edu.period}</p>
                <div class="featured-body">
                    <p class="featured-description">${edu.description}</p>
                </div>
                ${edu.tags ? `
                    <div class="tags">
                        ${edu.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="featured-footer">
                    <a href="journey.html" class="link">View Journey →</a>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render featured work (for home page - unified structure)
     * @param {Array} work - Work array
     * @returns {string}
     */
    renderFeaturedWork(work) {
        return work.map(job => `
            <div class="featured-card featured-work ${job.status === 'upcoming' ? 'featured-upcoming' : ''}">
                <div class="featured-badge">
                    <span class="badge ${job.status === 'upcoming' ? 'badge-warning' : 'badge-accent'}">${job.status === 'upcoming' ? 'Upcoming' : 'Work'}</span>
                </div>
                <h3 class="featured-title">${job.title}</h3>
                <p class="featured-subtitle">${job.company} • ${job.period}</p>
                <div class="featured-body">
                    <p class="featured-description">${job.description}</p>
                </div>
                ${job.tags && job.tags.length > 0 ? `
                    <div class="tags">
                        ${job.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="featured-footer">
                    <a href="journey.html" class="link">View Journey →</a>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render certifications
     * @param {Array} certifications - Certifications array
     * @returns {string}
     */
    renderCertifications(certifications) {
        return certifications.map(cert => `
            <div class="cert-card">
                <div class="cert-icon">
                    <img src="assets/CA/${cert.issuerIcon}.png" alt="${cert.issuer}" onerror="this.style.display='none'; this.parentElement.classList.add('${cert.issuerIcon}'); this.parentElement.textContent='${this.getIssuerInitials(cert.issuer)}';">
                </div>
                <h3>${cert.title}</h3>
                <p class="cert-issuer">${cert.issuer} • ${cert.date}${cert.certId ? ` • ID: ${cert.certId}` : ''}</p>
                <div class="cert-body">
                    <p class="cert-description">${cert.description}</p>
                </div>
                <div class="tags">
                    ${cert.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${cert.url ? `
                    <div class="cert-footer">
                        <a href="${cert.url}" target="_blank" class="link">View Certificate →</a>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Get issuer initials for icon (fallback)
     * @param {string} issuer
     * @returns {string}
     */
    getIssuerInitials(issuer) {
        if (issuer.includes('EC-Council')) return 'EC';
        if (issuer.includes('Politecnico')) return 'PM';
        if (issuer.includes('Udemy')) return 'U';
        if (issuer.includes('Brescia')) return 'UB';
        return issuer.substring(0, 2).toUpperCase();
    }

    /**
     * Render news items
     * @param {Array} news - News array
     * @returns {string}
     */
    renderNews(news) {
        return news.map(item => `
            ${item.showYear ? `
                <div class="news-year-marker">
                    <div class="news-year-dot"></div>
                    <span class="news-year-label">${item.year}</span>
                </div>
            ` : ''}
            <div class="news-item">
                <div class="news-marker"></div>
                <div class="news-content">
                    <h3 class="news-title">${item.icon} ${item.title}</h3>
                    <p class="news-description">${item.description}</p>
                    <div class="tags">
                        ${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render contact cards
     * @param {Object} social - Social data
     * @returns {string}
     */
    renderContactCards(social) {
        return `
            <a href="mailto:${social.email.address}" class="card contact-card">
                <div class="contact-icon">${social.email.icon}</div>
                <h3>Email</h3>
                <p>${social.email.address}</p>
            </a>
            <a href="${social.linkedin.url}" target="_blank" class="card contact-card">
                <div class="contact-icon">${social.linkedin.icon}</div>
                <h3>LinkedIn</h3>
                <p>@${social.linkedin.username}</p>
            </a>
            <a href="${social.github.url}" target="_blank" class="card contact-card">
                <div class="contact-icon">${social.github.icon}</div>
                <h3>GitHub</h3>
                <p>@${social.github.username}</p>
            </a>
            <a href="${social.cv.url}" target="_blank" class="card contact-card" download>
                <div class="contact-icon">${social.cv.icon}</div>
                <h3>CV</h3>
                <p>Download CV</p>
            </a>
        `;
    }

    /**
     * Render CTA section
     * @param {Object} cta - CTA data
     * @returns {string}
     */
    renderCTA(cta) {
        return `
            <div class="cta-content">
                <h2>${cta.title}</h2>
                <p>${cta.description}</p>
                <div class="cta-buttons">
                    <a href="${cta.primaryButton.href}" class="btn btn-white">${cta.primaryButton.text}</a>
                    ${cta.secondaryButton ? `
                        <a href="${cta.secondaryButton.href}" ${cta.secondaryButton.external ? 'target="_blank"' : ''} class="btn cta-btn-secondary">${cta.secondaryButton.text}</a>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

// Export singleton instance
window.TemplateRenderer = new TemplateRenderer();
