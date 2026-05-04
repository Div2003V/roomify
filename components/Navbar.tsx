import {Box} from "lucide-react";
import Button from "./ui/Button";

const Navbar = () => {
    return (
        <header className="navbar">
            <nav className="inner">
                <div className="left">
                    <div className="brand">
                        <Box  className="logo" />

                        <span className="name">
                            ArchLensAI
                        </span>
                    </div>

                    <ul className="links">
                        <a href="#">Product</a>
                        <a href="#">Pricing</a>
                        <a href="#">Community</a>
                        <a href="#">Enterprise</a>
                    </ul>
                </div>

                <div className="actions">
                    <Button size="sm" variant="ghost">
                        Watch Demo
                    </Button>
                    <a href="#upload" className="cta">Get Started</a>
                </div>
            </nav>
        </header>
    )
}

export default Navbar
