const menu = document.querySelector('#mobile-menu')
const menuLinks = document.querySelector('.navbar__menu')

menu.addEventListener('click', function() {
    menu.classList.toggle('is-active')
    menuLinks.classList.toggle('active')
})

// Typing functionality
document.addEventListener("DOMContentLoaded", function() {
    const typedText = document.getElementById("typed-name");
    const message = "Viktor Laurens De Groote.";
    let i = 0;
    
    function typeWriter() {
        if (i < message.length) {
            typedText.innerHTML += message.charAt(i);
            i++;
            setTimeout(typeWriter, 100); // Adjust typing speed if needed
        }
    }

    // Create an observer to detect when the section is in view
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Delay the typewriter start by 3.7 seconds (3.5s animation + 200ms buffer)
                setTimeout(typeWriter, 2800);
                observer.unobserve(entry.target); // Stop observing once it has started typing
            }
        });
    }, {
        threshold: 0.5 // Trigger when 50% of the section is visible
    });

    // Observe the section that contains the typing effect
    const target = document.querySelector(".first__content");
    observer.observe(target);
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Horizontal bar animation
// Select the horizontal bar element
const horizontalBar = document.querySelector('.horizontal-bar');

// Function to update the width of the bar based on scroll position
function updateBarWidth() {
  // Get the total scrollable height of the page
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  
  // Calculate how far the user has scrolled as a percentage
  const scrollPosition = window.scrollY / scrollableHeight;
  
  // Set the width of the horizontal bar based on scroll percentage
  horizontalBar.style.width = `${scrollPosition * 100}%`;
}

// Event listener to update the bar as the user scrolls
window.addEventListener('scroll', updateBarWidth);

// Divider bar animation
window.addEventListener('scroll', function() {
    const scrollTop = window.scrollY;
    const scrollFactor = Math.min(scrollTop / (window.innerHeight * 0.8), 1); // Limit effect to the viewport height
  
    const maxWidth = window.innerWidth - 100; // Screen width minus 50px margins on both sides
    const currentWidth = Math.max(10, scrollFactor * maxWidth); // Expanding the line width with scrolling
  
    const line = document.querySelector('.divider-bar');
    line.style.width = `${currentWidth}px`;
  
    // Maintain the rounded ends of the line while it expands
    line.style.borderRadius = '50px'; // Half circles on both ends
    line.style.background = 'linear-gradient(90deg, var(--oxford-blue) 0%, var(--navy-blue) 33%, var(--french-blue) 66%, var(--vivid-sky-blue) 100%)';
});





  






