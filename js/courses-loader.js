/**
 * Courses Loader
 * Dynamically loads courses and certifications from JSON
 */

class CoursesLoader {
    constructor() {
        this.coursesData = null;
    }

    async loadCourses() {
        try {
            const response = await fetch('data/courses.json');
            if (!response.ok) throw new Error('Failed to load courses');
            this.coursesData = await response.json();
            this.renderAll();
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    renderAll() {
        this.renderMastersCourses();
        this.renderBachelorsCourses();
        this.renderCertifications();
    }

    renderMastersCourses() {
        const container = document.getElementById('masters-grid');
        if (!container || !this.coursesData) return;

        container.innerHTML = this.coursesData.masters.map(course => this.createCourseCard(course, 'master')).join('');
    }

    renderBachelorsCourses() {
        const container = document.getElementById('bachelors-grid');
        if (!container || !this.coursesData) return;

        container.innerHTML = this.coursesData.bachelors.map(course => this.createCourseCard(course, 'bachelor')).join('');
    }

    renderCertifications() {
        const container = document.getElementById('certifications-grid');
        if (!container || !this.coursesData) return;

        container.innerHTML = this.coursesData.certifications.map(cert => this.createCertCard(cert)).join('');
    }

    createCourseCard(course, type) {
        const tagsHtml = course.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
        
        return `
            <div class="course-card ${type}">
                <div class="course-header">
                    <h3>${course.title}</h3>
                    <span class="course-grade">${course.grade}</span>
                </div>
                <p class="course-description">
                    ${course.description}
                </p>
                <div class="tags">
                    ${tagsHtml}
                </div>
                <a href="${course.link}" target="_blank" class="course-link" title="Course Info">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                </a>
            </div>
        `;
    }

    createCertCard(cert) {
        const tagsHtml = cert.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const featuredClass = cert.featured ? 'featured' : '';
        const idText = cert.id ? ` • ID: ${cert.id}` : '';
        
        return `
            <div class="cert-card ${featuredClass}">
                <div class="cert-icon ${cert.icon}">${this.getIconText(cert.icon)}</div>
                <h3>${cert.title}</h3>
                <p class="cert-issuer">${cert.issuer} • ${cert.date}${idText}</p>
                <p class="cert-description">
                    ${cert.description}
                </p>
                <div class="tags">
                    ${tagsHtml}
                </div>
                <a href="${cert.link}" target="_blank" class="cert-link" title="View Certification">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                </a>
            </div>
        `;
    }

    getIconText(iconType) {
        const iconMap = {
            'ec-council': 'EC',
            'polimi': 'PM',
            'udemy': 'U',
            'unibs': 'UB'
        };
        return iconMap[iconType] || iconType.charAt(0).toUpperCase();
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const coursesLoader = new CoursesLoader();
    coursesLoader.loadCourses();
});
