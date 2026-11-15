import { Guard } from "./components/Guard";
import { SearchMessages } from "./components/SearchMessages";

export default function Command() {
  return <Guard scope="chat:read">{(orbit) => <SearchMessages orbit={orbit} />}</Guard>;
}
