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
    const target = document.querySelector(".main__content");
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



