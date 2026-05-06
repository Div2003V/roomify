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
                </div>
            </nav>
        </header>
    )
}

export default Navbar
