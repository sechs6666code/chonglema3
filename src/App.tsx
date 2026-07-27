import Prototype from "./Prototype";
import { KeyboardProvider } from "./mobile";
import { MobileDeviceProvider } from "./mobile/Device";

export default function App() {
  return (
    <MobileDeviceProvider>
      <KeyboardProvider>
        <div className="standalone-app-shell" data-testid="standalone-app-shell">
          <Prototype />
        </div>
      </KeyboardProvider>
    </MobileDeviceProvider>
  );
}
